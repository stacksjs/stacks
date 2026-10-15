import { describe, expect, it } from 'bun:test'
import { verifyAccessTokenInsert } from '../src/tokens'

/**
 * stacksjs/stacks#2902. `expires_at` names no timezone, so the value a driver
 * hands back is its own reading of it. One API process returned the naive
 * literal `21:22:38` as a Date meaning `13:22:38Z`, eight hours early, while a
 * standalone script against the same column and the same `db` export
 * round-tripped exactly. The row was stored correctly either way, so comparing
 * a parsed Date against the instant asked for rejected good tokens and 500'd
 * every login and register on that host.
 *
 * The database now answers the comparison, and these pin that the parsed value
 * cannot decide the outcome.
 */
const EXPECTED = {
  ownerId: 42,
  ownerType: 'User',
  clientId: 7,
  scopes: ['*'],
  expiresAt: new Date('2026-10-15T21:22:38.565Z'),
}

function row(overrides: Record<string, unknown> = {}): any {
  return {
    id: 1,
    tokenable_id: 42,
    user_id: 42,
    tokenable_type: 'User',
    oauth_client_id: 7,
    revoked: false,
    expires_at: '2026-10-15T21:22:38.565',
    expires_at_matches: true,
    scopes: JSON.stringify(['*']),
    created_at: '2026-10-15T21:22:38.565',
    updated_at: null,
    ...overrides,
  }
}

describe('verifyAccessTokenInsert (stacksjs/stacks#2902)', () => {
  it('accepts a stored row whose date came back localized', () => {
    // Exactly the shape the API process produced: eight hours early, and
    // stored correctly, which the database confirms.
    const localized = new Date('2026-10-15T13:22:38.565Z')
    // The predicate this replaced: a parsed Date against the instant asked
    // for. It disagrees, which is the whole bug, and the row is still good.
    expect(localized.getTime()).not.toBe(EXPECTED.expiresAt.getTime())
    expect(() => verifyAccessTokenInsert(row({ expires_at: localized }), EXPECTED)).not.toThrow()
  })

  it('accepts the 1 that MySQL and SQLite answer with', () => {
    expect(() => verifyAccessTokenInsert(row({ expires_at_matches: 1 }), EXPECTED)).not.toThrow()
  })

  it('rejects a row the database says does not match', () => {
    for (const matches of [false, 0]) {
      expect(() => verifyAccessTokenInsert(row({ expires_at_matches: matches }), EXPECTED))
        .toThrow('Failed to persist the requested access token')
    }
  })

  it('rejects a comparison that produced nothing, rather than reading it as a pass', () => {
    // A null comparison, or a select that never asked: neither is a match.
    for (const matches of [null, undefined])
      expect(() => verifyAccessTokenInsert(row({ expires_at_matches: matches }), EXPECTED)).toThrow()
  })

  it('still checks everything else about the row', () => {
    expect(() => verifyAccessTokenInsert(row({ tokenable_id: 43 }), EXPECTED)).toThrow()
    expect(() => verifyAccessTokenInsert(row({ oauth_client_id: 8 }), EXPECTED)).toThrow()
    expect(() => verifyAccessTokenInsert(row({ revoked: true }), EXPECTED)).toThrow()
    expect(() => verifyAccessTokenInsert(row({ scopes: JSON.stringify(['read']) }), EXPECTED)).toThrow()
  })
})
