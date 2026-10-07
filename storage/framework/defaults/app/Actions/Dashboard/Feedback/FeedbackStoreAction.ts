import type { RequestInstance } from '@stacksjs/types'
import { randomUUID } from 'node:crypto'
import { Action } from '@stacksjs/actions/runtime'
import { db, getDatabaseDialect, sqlHelpers } from '@stacksjs/database/runtime'
import { response } from '@stacksjs/router'
import { kanbanActionError } from '../Kanban/kanban-response'
import {
  acceptAttachment,
  acceptAttachmentSize,
  FEEDBACK_ATTACHMENT_MAX_FILES,
  feedbackAttachmentPath,
  SNIFF_BYTES,
} from './feedback-attachment'
import { notifyFeedbackFiled } from './feedback-notifier'
import {
  authorizeFeedbackToken,
  FEEDBACK_MAX_DESCRIPTION as MAX_DESCRIPTION,
  FEEDBACK_MAX_TITLE as MAX_TITLE,
  hashFeedbackToken,
  looksLikeFeedbackToken,
  refusalMessage,
} from './feedback-token'

interface FeedbackInput {
  title?: unknown
  description?: unknown
}

/**
 * Write the screenshot and record it against the card.
 *
 * Runs after the card exists, because the path is keyed by card id. A failure
 * here is logged and swallowed: the report is already saved and is worth more
 * than the picture, and telling the reviewer their submission failed would
 * invite a resubmit that files the card twice.
 */
async function storeAttachment(
  cardId: number,
  attachment: { bytes: Uint8Array, mimeType: string, extension: string },
): Promise<void> {
  try {
    const { dashboard } = await import('@stacksjs/config')
    // `local` is private storage under `storage/app`. The default is not read
    // from `filesystems.driver`, which an app may point at `public`: an
    // unauthenticated stranger's upload does not belong in a web-served
    // directory.
    const disk = String((dashboard as any)?.feedback?.attachments?.disk || 'local')
    const path = feedbackAttachmentPath(cardId, randomUUID(), attachment.extension)

    const { Storage } = await import('@stacksjs/storage')
    await Storage.disk(disk as never).write(path, attachment.bytes)

    const { CardAttachment } = await import('@stacksjs/orm')
    await CardAttachment.create({
      cardId,
      disk,
      path,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.bytes.byteLength,
    })
  }
  catch (err) {
    console.warn(`[FeedbackStoreAction] card ${cardId} was filed without its screenshot: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * `POST /api/feedback/{token}`.
 *
 * The one unauthenticated write path the dashboard has, so it is deliberately
 * narrow: a feedback link may add a card to the one board its token names,
 * and may not read anything (stacksjs/stacks#2872).
 *
 * Every refusal answers 404 with the same sentence. A 401 would confirm the
 * link once existed, and distinguishing unknown from revoked from expired
 * tells a holder of a guessed token which half of the guess was right, or
 * tells a revoked reviewer they were revoked rather than that the link simply
 * stopped working. The reason is logged, not returned.
 *
 * Rate limited at the route rather than here, the way the other
 * unauthenticated endpoints are.
 */
export default new Action({
  name: 'Feedback Store',
  description: 'Files a card on one board from a revocable feedback link.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance<FeedbackInput>) {
    const raw = String(request.getParam('token') || '')

    // Shape before lookup, so a submit carrying a sentence, a path or a SQL
    // fragment costs no query.
    if (!looksLikeFeedbackToken(raw))
      return response.json({ message: refusalMessage() }, 404)

    const body = request.all()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title || title.length > MAX_TITLE)
      return response.json({ message: `A title is required, up to ${MAX_TITLE} characters.` }, 400)

    // Rejected rather than truncated. Silently dropping the end of somebody's
    // report is worse than telling them it was too long.
    const rawDescription = typeof body.description === 'string' ? body.description.trim() : ''
    if (rawDescription.length > MAX_DESCRIPTION)
      return response.json({ message: `The description must be ${MAX_DESCRIPTION} characters or fewer.` }, 400)
    const description = rawDescription || undefined

    // The screenshot is judged BEFORE anything is written. Filing the card
    // first and then refusing the file would show the reviewer an error for a
    // report that was in fact saved, and the obvious thing to do about an
    // error is to send it again.
    const sent = request.getFiles('screenshot')
    const screenshot = sent.length > 0 ? sent[0] : request.file('screenshot')
    if (sent.length > FEEDBACK_ATTACHMENT_MAX_FILES)
      return response.json({ message: `Attach ${FEEDBACK_ATTACHMENT_MAX_FILES === 1 ? 'one screenshot' : `${FEEDBACK_ATTACHMENT_MAX_FILES} screenshots`} at most.` }, 400)

    let attachment: { bytes: Uint8Array, mimeType: string, extension: string } | undefined
    if (screenshot) {
      // Size first, and on its own. The router hands this an `UploadedFile`
      // wrapper, which reports `size` synchronously and has no `slice`, so
      // reading the leading bytes means reading the whole file. Sniffing
      // first would load a 2 GB upload into memory to decide it was too
      // large.
      const size = Number(screenshot.size || 0)
      const sized = acceptAttachmentSize(size)
      if (!sized.ok)
        return response.json({ message: sized.message }, 400)

      const bytes = await screenshot.bytes()
      const verdict = acceptAttachment({ size, head: bytes.subarray(0, SNIFF_BYTES) })
      if (!verdict.ok)
        return response.json({ message: verdict.message }, 400)

      attachment = {
        bytes,
        // From the bytes, never from `screenshot.mimeType`, which the
        // submitter writes. The dashboard serves the file as this.
        mimeType: verdict.type,
        extension: verdict.extension,
      }
    }

    try {
      const token = await (db as any)
        .selectFrom('feedback_tokens')
        .where('token', '=', hashFeedbackToken(raw))
        .select(['id', 'board_id', 'revoked_at', 'expires_at', 'label'])
        .executeTakeFirst()

      const verdict = authorizeFeedbackToken(token)
      if (!verdict.ok) {
        // Logged with its reason and never with the token, so an operator can
        // tell a revoked link from a guessed one without the log holding a
        // live credential.
        console.warn(`[FeedbackStoreAction] refused a submission: ${verdict.reason}`)
        return response.json({ message: refusalMessage() }, 404)
      }

      const { param } = sqlHelpers(getDatabaseDialect())

      // The board is checked rather than assumed. `feedback_tokens.board_id`
      // cascades on delete, but SQLite enforces that only with
      // `foreign_keys = ON`, which the framework sets while renaming and not
      // otherwise, so a token can outlive its board.
      const column = await db.unsafe(
        `SELECT id FROM board_columns WHERE board_id = ${param(1)} ORDER BY position ASC, id ASC LIMIT 1`,
        [verdict.boardId],
      ).execute() as Array<{ id: number }>
      const columnId = Number(column?.[0]?.id)
      if (!Number.isInteger(columnId) || columnId <= 0) {
        // The link is valid and there is nowhere to put the card. Not the
        // submitter's problem to diagnose, so they get the same sentence.
        console.warn(`[FeedbackStoreAction] board ${verdict.boardId} has no column to file into`)
        return response.json({ message: refusalMessage() }, 404)
      }

      const maxRow = await db.unsafe(
        `SELECT COALESCE(MAX(position), -1) AS m FROM cards WHERE column_id = ${param(1)}`,
        [columnId],
      ).execute() as Array<{ m: number }>
      const nextPosition = (Number(maxRow?.[0]?.m ?? -1) + 1) || 0

      const { Card } = await import('@stacksjs/orm')
      const card = await Card.create({
        columnId,
        boardId: verdict.boardId,
        title,
        description,
        position: nextPosition,
        // No user. A feedback link authenticates nobody, which is the point
        // of it, so the card is attributed by its board and its label rather
        // than by an account that does not exist.
        createdByUserId: null,
        dueDate: null,
        archived: false,
      })

      await db.unsafe(
        `UPDATE feedback_tokens SET last_used_at = ${param(1)} WHERE id = ${param(2)}`,
        [new Date().toISOString().slice(0, 19).replace('T', ' '), Number(token.id)],
      ).execute()

      const cardId = Number(card.get('id'))

      if (attachment)
        await storeAttachment(cardId, attachment)

      // `void`: the card is saved, so the reviewer is told it went through
      // whatever the notification does. Blocking on an SMTP round-trip would
      // make a mail outage look like a failed submission, and failing on one
      // would be worse.
      void notifyFeedbackFiled({
        boardId: verdict.boardId,
        cardId,
        title,
        description,
        label: String(token.label ?? ''),
      })

      // Acknowledgement only. Returning the card, its position or anything
      // about the board would make this a read endpoint, which it is not.
      return { filed: true, id: cardId }
    }
    catch (err) {
      return kanbanActionError(err, 'FeedbackStoreAction')
    }
  },
})
