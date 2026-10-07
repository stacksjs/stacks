import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The dashboard's only unauthenticated write path.
 *
 * A feedback link lets somebody with no account add a card to one board
 * (stacksjs/stacks#2872). The properties below are the ones that make that
 * safe, and each is the kind that survives a refactor only if something
 * checks it.
 */
describe('feedback intake contract', () => {
  const action = readFileSync(resolve('storage/framework/defaults/app/Actions/Dashboard/Feedback/FeedbackStoreAction.ts'), 'utf8')
  const routes = readFileSync(resolve('storage/framework/defaults/routes/dashboard.ts'), 'utf8')

  test('answers every refusal identically, and never with 401 or 403', () => {
    // A 401 confirms the link once existed, and a distinct message per reason
    // tells a holder of a guessed token which half of the guess was right, or
    // tells a revoked reviewer they were revoked rather than that the link
    // stopped working.
    const refusals = action.match(/response\.json\(\{ message: refusalMessage\(\) \}, 404\)/g)
    expect(refusals?.length).toBe(3)
    expect(action).not.toMatch(/,\s*40[13]\)/)
  })

  test('checks the token shape before it queries', () => {
    // So a submit carrying a sentence, a path or a SQL fragment costs no
    // database round trip.
    const shapeCheck = action.indexOf('looksLikeFeedbackToken(raw)')
    const lookup = action.indexOf("selectFrom('feedback_tokens')")
    expect(shapeCheck).toBeGreaterThan(-1)
    expect(lookup).toBeGreaterThan(shapeCheck)
  })

  test('logs why it refused without logging the token', () => {
    expect(action).toContain('verdict.reason')
    // The raw token and its hash are both credentials. Neither belongs in a
    // log line that an operator will paste somewhere.
    expect(action).not.toMatch(/console\.(warn|error|log)\([^)]*\braw\b/)
    expect(action).not.toMatch(/console\.(warn|error|log)\([^)]*hashFeedbackToken/)
  })

  test('acknowledges rather than reading the board back', () => {
    // Returning the card, its position, its column or anything about the
    // board would make a write-only capability into a read endpoint.
    //
    // Asserted on the fields rather than the exact expression, which pinned
    // `Number(card.get('id'))` and so failed when the id was lifted into a
    // variable to be notified with. The contract is which fields go back, not
    // how the id is spelled.
    const acknowledgement = action.match(/return \{ filed: true[^}]*\}/)
    expect(acknowledgement).not.toBeNull()
    expect(acknowledgement![0]).toMatch(/\bid\b/)
    for (const leak of ['boardId', 'columnId', 'position', 'title', 'description', 'label'])
      expect(acknowledgement![0]).not.toContain(leak)
  })

  test('judges the screenshot before anything is written', () => {
    // Filing the card and then refusing the file would show the reviewer an
    // error for a report that was in fact saved, and the obvious response to
    // an error is to send it again.
    const verdict = action.indexOf('acceptAttachment({')
    const create = action.indexOf('Card.create(')
    expect(verdict).toBeGreaterThan(-1)
    expect(create).toBeGreaterThan(-1)
    expect(verdict).toBeLessThan(create)
  })

  test('refuses an oversized upload before it reads it', () => {
    // The router hands this an `UploadedFile` wrapper: `size` is synchronous
    // and there is no `slice`, so reading the leading bytes means reading the
    // whole file. The first version sniffed first and threw
    // `screenshot.slice is not a function` on every upload, which no unit
    // test could see because they all pass a plain Uint8Array.
    const gate = action.indexOf('acceptAttachmentSize(size)')
    const read = action.indexOf('await screenshot.bytes()')
    expect(gate).toBeGreaterThan(-1)
    expect(read).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(read)
    expect(action).not.toContain('screenshot.slice')
  })

  test('records what the bytes are, not what the upload claimed', () => {
    // `screenshot.type` and the filename are both written by whoever is
    // uploading. The dashboard serves the file as the recorded type, so a
    // claimed one would be a stored content-type confusion.
    expect(action).toContain('mimeType: verdict.type')
    expect(action).not.toMatch(/mimeType:\s*(String\()?screenshot\.type/)
    expect(action).not.toMatch(/screenshot\.name/)
  })

  test('builds the storage path itself, from no part of the upload', () => {
    // Path traversal through an upload's filename is the oldest bug in this
    // category, and the extension comes from the sniffed type rather than
    // from the name.
    expect(action).toContain('feedbackAttachmentPath(cardId, randomUUID(), attachment.extension)')
  })

  test('writes a stranger\'s upload to a private disk', () => {
    // `filesystems.driver` may be `public`, which is a web-served directory.
    expect(action).toContain("?.attachments?.disk || 'local'")
    expect(action).not.toMatch(/disk\(['"]public['"]\)/)
  })

  test('keeps a failed upload from failing the submission', () => {
    // The report is saved by then and is worth more than the picture, and a
    // reviewer told their submission failed would send it again.
    const helper = action.slice(action.indexOf('async function storeAttachment'))
    expect(helper).toMatch(/catch \(err\) \{[\s\S]*console\.warn/)
    expect(helper.slice(0, helper.indexOf('catch'))).not.toContain('throw')
  })

  test('notifies without handing the notification a token', () => {
    // The card is saved before this fires, so the notification must not be
    // able to fail the submission, and it must not carry the credential into
    // an email, an SMS or a Slack channel.
    const call = action.match(/void notifyFeedbackFiled\(\{[^}]*\}\)/)
    expect(call).not.toBeNull()
    expect(call![0]).not.toMatch(/\braw\b|hashFeedbackToken|\btoken\.token\b/)
    expect(call![0]).toContain('void ')
  })

  test('verifies the board instead of trusting the cascade', () => {
    // `feedback_tokens.board_id` cascades on delete, but SQLite enforces that
    // only with `foreign_keys = ON`, which the framework sets while renaming
    // and not otherwise. So a token can outlive its board.
    expect(action).toContain("FROM board_columns WHERE board_id =")
    expect(action).toContain('Number.isInteger(columnId)')
  })

  test('files the card as nobody', () => {
    // A feedback link authenticates no one, which is the whole design. If
    // this ever stamps a user id, the capability has become an identity.
    expect(action).toContain('createdByUserId: null')
    expect(action).not.toContain('request.user()')
  })

  test('is routed outside every auth group, rate limited, and CSRF-exempt', () => {
    const line = routes.split('\n').find(l => l.includes("'/api/feedback/{token}'"))
    expect(line).toBeDefined()

    // Grouped routes are indented inside their `route.group(...)` callback.
    // A feedback link has no session, so landing in an `auth` group would
    // make the endpoint unreachable rather than insecure, but it would make
    // it silently unreachable.
    expect(line!.startsWith('route.post(')).toBe(true)
    expect(line).not.toContain("middleware('auth')")
    expect(line).toContain('skipCsrf()')
    expect(line).toMatch(/rateLimit\(\d+, 'minute'\)/)
  })
})
