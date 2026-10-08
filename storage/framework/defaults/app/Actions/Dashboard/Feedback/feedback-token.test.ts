import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import {
  authorizeFeedbackToken,
  hashFeedbackToken,
  looksLikeFeedbackToken,
  mintFeedbackToken,
  parseTokenTime,
  refusalMessage,
} from './feedback-token'

/**
 * The security boundary for an unauthenticated write path.
 *
 * Every branch is tested here rather than through the action, because a
 * decision reachable only via an HTTP request is a decision that does not get
 * tested properly, and this one decides whether a stranger may write to a
 * board (stacksjs/stacks#2872).
 */

const VALID = 'a'.repeat(64)
const FUTURE = new Date(Date.now() + 86_400_000).toISOString()
const PAST = new Date(Date.now() - 86_400_000).toISOString()

describe('hashFeedbackToken', () => {
  it('is SHA-256 hex of the raw value', () => {
    expect(hashFeedbackToken('hello')).toBe(createHash('sha256').update('hello').digest('hex'))
    expect(hashFeedbackToken(VALID)).toHaveLength(64)
  })
})

describe('mintFeedbackToken', () => {
  it('mints a raw token that matches its own hash', () => {
    const { raw, hash } = mintFeedbackToken()

    expect(looksLikeFeedbackToken(raw)).toBe(true)
    expect(hash).toBe(hashFeedbackToken(raw))
  })

  it('does not repeat itself', () => {
    // 256 bits, so a collision here means the generator is broken rather
    // than that we got unlucky.
    const mints = new Set(Array.from({ length: 50 }, () => mintFeedbackToken().raw))
    expect(mints.size).toBe(50)
  })
})

describe('looksLikeFeedbackToken', () => {
  it('accepts a raw token', () => {
    expect(looksLikeFeedbackToken(VALID)).toBe(true)
  })

  it('rejects anything that is not one, before any lookup happens', () => {
    // The point of the shape check: a submit carrying a sentence, a path or a
    // SQL fragment is refused without touching the database.
    for (const candidate of [
      '',
      'a'.repeat(63),
      'a'.repeat(65),
      'A'.repeat(64),
      `${'a'.repeat(63)}g`,
      '../../etc/passwd',
      "' OR 1=1 --",
      null,
      undefined,
      42,
      { toString: () => VALID },
    ])
      expect(looksLikeFeedbackToken(candidate)).toBe(false)
  })
})

describe('authorizeFeedbackToken', () => {
  it('admits a live token and reports its board', () => {
    expect(authorizeFeedbackToken({ boardId: 7, expiresAt: FUTURE })).toEqual({ ok: true, boardId: 7 })
    expect(authorizeFeedbackToken({ boardId: 7 })).toEqual({ ok: true, boardId: 7 })
  })

  it('refuses a token it never found', () => {
    expect(authorizeFeedbackToken(null)).toEqual({ ok: false, reason: 'unknown' })
    expect(authorizeFeedbackToken(undefined)).toEqual({ ok: false, reason: 'unknown' })
  })

  it('refuses a revoked token, which is the point of the design', () => {
    expect(authorizeFeedbackToken({ boardId: 7, revokedAt: PAST })).toEqual({ ok: false, reason: 'revoked' })
  })

  it('reports revocation ahead of expiry when a token is both', () => {
    // An operator who pulled a link wants to see that they pulled it, not
    // that it later lapsed on its own.
    const verdict = authorizeFeedbackToken({ boardId: 7, revokedAt: PAST, expiresAt: PAST })
    expect(verdict).toEqual({ ok: false, reason: 'revoked' })
  })

  it('refuses an expired token, counting the exact moment as expired', () => {
    const now = new Date('2026-10-07T12:00:00.000Z')
    // Measured from this test's `now`, not the clock: the shared PAST is a day
    // before the real time, which passed this fixed moment on 2026-10-08 and
    // turned "expired" into a token that expires tomorrow.
    const past = new Date(now.getTime() - 86_400_000).toISOString()
    expect(authorizeFeedbackToken({ boardId: 7, expiresAt: past }, now)).toEqual({ ok: false, reason: 'expired' })
    expect(authorizeFeedbackToken({ boardId: 7, expiresAt: now.toISOString() }, now)).toEqual({ ok: false, reason: 'expired' })
  })

  it('still reads a stored timestamp when deciding expiry', () => {
    const now = new Date('2026-10-07T12:00:00.000Z')
    expect(authorizeFeedbackToken({ boardId: 7, expires_at: '2026-10-07 18:00:00' }, now)).toEqual({ ok: true, boardId: 7 })
    expect(authorizeFeedbackToken({ boardId: 7, expires_at: '2026-10-07 06:00:00' }, now)).toEqual({ ok: false, reason: 'expired' })
  })

  it('refuses a token bound to no usable board', () => {
    // Without this the action would resolve a board of `NaN` and the card
    // would land nowhere, or worse, somewhere.
    for (const row of [{}, { boardId: 0 }, { boardId: -1 }, { boardId: 'the board' }, { boardId: 1.5 }])
      expect(authorizeFeedbackToken(row)).toEqual({ ok: false, reason: 'unbound' })
  })

  it('accepts either spelling the ORM returns', () => {
    expect(authorizeFeedbackToken({ board_id: 9 })).toEqual({ ok: true, boardId: 9 })
    expect(authorizeFeedbackToken({ board_id: 9, revoked_at: PAST })).toEqual({ ok: false, reason: 'revoked' })
  })

  it('never carries the token into its verdict', () => {
    // The verdict is logged. A reason and a board id are safe; the thing
    // being checked is not.
    const verdict = authorizeFeedbackToken({ boardId: 7, revokedAt: PAST })
    expect(JSON.stringify(verdict)).not.toContain(VALID)
    expect(JSON.stringify(verdict)).not.toContain('revokedAt')
  })
})

describe('parseTokenTime', () => {
  it('reads a SQLite datetime as UTC, in any timezone', () => {
    // `YYYY-MM-DD HH:MM:SS` is what SQLite hands back, and `Date` parses it
    // as local time on some engines. Left alone, a token expires hours early
    // or late depending on the dialect and the machine's clock.
    //
    // Asserted here rather than through a verdict: both readings of a row
    // usually fall on the same side of `now`, so the verdict-level version of
    // this test passed with the normalisation deleted.
    expect(parseTokenTime('2026-10-07 09:00:00')).toBe(Date.parse('2026-10-07T09:00:00Z'))
    expect(parseTokenTime('2026-10-07 23:59:59')).toBe(Date.parse('2026-10-07T23:59:59Z'))
  })

  it('passes through the forms that are already unambiguous', () => {
    expect(parseTokenTime('2026-10-07T09:00:00Z')).toBe(Date.parse('2026-10-07T09:00:00Z'))
    expect(parseTokenTime(new Date('2026-10-07T09:00:00Z'))).toBe(Date.parse('2026-10-07T09:00:00Z'))
    expect(parseTokenTime(1_760_000_000_000)).toBe(1_760_000_000_000)
  })

  it('reports an unreadable value as absent rather than as epoch zero', () => {
    // `null` means "does not expire". A timestamp that failed to parse must
    // not become 1970, which would read as expired and lock out a live link.
    expect(parseTokenTime('not a date')).toBeNull()
    expect(parseTokenTime(null)).toBeNull()
    expect(parseTokenTime(undefined)).toBeNull()
    expect(parseTokenTime({})).toBeNull()
  })
})

describe('refusalMessage', () => {
  it('says the same thing however the token failed', () => {
    // Distinguishing unknown from revoked from expired tells someone holding
    // a guessed token which half of the guess was right, and tells a revoked
    // reviewer they were revoked rather than that the link simply stopped
    // working.
    expect(refusalMessage()).toBe('This feedback link is not valid.')
    expect(refusalMessage()).not.toMatch(/revoke|expire|unknown|board/i)
  })
})
