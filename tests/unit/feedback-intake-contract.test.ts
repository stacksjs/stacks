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
    expect(action).toContain('return { filed: true, id: Number(card.get(\'id\')) }')
    expect(action).not.toMatch(/return \{[^}]*\bboardId\b/)
    expect(action).not.toMatch(/return \{[^}]*\bcolumnId\b/)
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
