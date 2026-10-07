import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { db, getDatabaseDialect, sqlHelpers } from '@stacksjs/database/runtime'
import { response } from '@stacksjs/router'
import { kanbanActionError } from '../Kanban/kanban-response'
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

    try {
      const token = await (db as any)
        .selectFrom('feedback_tokens')
        .where('token', '=', hashFeedbackToken(raw))
        .select(['id', 'board_id', 'revoked_at', 'expires_at'])
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

      // Acknowledgement only. Returning the card, its position or anything
      // about the board would make this a read endpoint, which it is not.
      return { filed: true, id: Number(card.get('id')) }
    }
    catch (err) {
      return kanbanActionError(err, 'FeedbackStoreAction')
    }
  },
})
