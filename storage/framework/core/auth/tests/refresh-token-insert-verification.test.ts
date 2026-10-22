import { describe, expect, it } from 'bun:test'
import { verifyAccessTokenInsert, verifyRefreshTokenRow } from '../src/tokens'

/**
 * stacksjs/stacks#2902, the half 003b8856d8 did not reach.
 *
 * Login issues a refresh token by default, and its read-back still compared a
 * parsed Date against the instant asked for. A process that reads a zoneless
 * column eight hours early passed the access token check after that fix and
 * then 500'd the same login here, with "Failed to persist the requested
 * refresh token". The database answers the comparison now, as it does for the
 * access token.
 */
const EXPECTED = { accessTokenId: 9 }
/** The instant the refresh token was issued to expire at. */
const EXPIRES_AT = new Date('2026-11-14T21:22:38.565Z')

function row(overrides: Record<string, unknown> = {}): any {
  return {
    access_token_id: 9,
    revoked: false,
    expires_at: '2026-11-14T21:22:38.565',
    expires_at_matches: true,
    ...overrides,
  }
}

describe('verifyRefreshTokenRow (stacksjs/stacks#2902)', () => {
  it('accepts a stored row whose date came back localized', () => {
    const localized = new Date('2026-11-14T13:22:38.565Z')
    expect(localized.getTime()).not.toBe(EXPIRES_AT.getTime())
    expect(() => verifyRefreshTokenRow([row({ expires_at: localized })], EXPECTED)).not.toThrow()
  })

  it('accepts the 1 that MySQL and SQLite answer with', () => {
    expect(() => verifyRefreshTokenRow([row({ expires_at_matches: 1 })], EXPECTED)).not.toThrow()
  })

  it('rejects a row the database says does not match, or could not compare', () => {
    for (const matches of [false, 0, null, undefined]) {
      expect(() => verifyRefreshTokenRow([row({ expires_at_matches: matches })], EXPECTED))
        .toThrow('Failed to persist the requested refresh token')
    }
  })

  it('still checks everything else about the row', () => {
    expect(() => verifyRefreshTokenRow([row({ access_token_id: 10 })], EXPECTED)).toThrow()
    expect(() => verifyRefreshTokenRow([row({ revoked: true })], EXPECTED)).toThrow()
    expect(() => verifyRefreshTokenRow([], EXPECTED)).toThrow()
    expect(() => verifyRefreshTokenRow([row(), row()], EXPECTED)).toThrow()
  })
})

/**
 * Each check raised one message for several different mismatches, so a 500
 * on the reporting host never said which field was wrong, and every round of
 * #2902 assumed it was the expiry. The message now names it.
 */
describe('a failed read-back names the field that differed', () => {
  const ACCESS = { ownerId: 42, ownerType: 'User', clientId: 7, scopes: ['*'], expiresAt: new Date('2026-10-15T21:22:38.565Z') }
  const accessRow = (overrides: Record<string, unknown> = {}): any => ({
    id: 1, tokenable_id: 42, user_id: 42, tokenable_type: 'User', oauth_client_id: 7, revoked: false,
    expires_at: '2026-10-15T21:22:38.565', expires_at_matches: true, scopes: JSON.stringify(['*']),
    created_at: null, updated_at: null, ...overrides,
  })

  it('for the access token', () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ tokenable_id: 43 }, 'tokenable_id'],
      [{ user_id: 43 }, 'user_id'],
      [{ tokenable_type: 'Team' }, 'tokenable_type'],
      [{ oauth_client_id: 8 }, 'oauth_client_id'],
      [{ revoked: true }, 'revoked'],
      [{ expires_at_matches: false }, 'expires_at'],
      [{ scopes: JSON.stringify(['read']) }, 'scopes'],
    ]
    for (const [overrides, field] of cases)
      expect(() => verifyAccessTokenInsert(accessRow(overrides), ACCESS)).toThrow(`Failed to persist the requested access token: ${field} did not match what was written`)
  })

  it('lists every field that differed, not just the first', () => {
    expect(() => verifyAccessTokenInsert(accessRow({ revoked: true, expires_at_matches: 0 }), ACCESS))
      .toThrow('revoked, expires_at did not match what was written')
  })

  it('for the refresh token', () => {
    expect(() => verifyRefreshTokenRow([row({ access_token_id: 10 })], EXPECTED)).toThrow('access_token_id did not match')
    expect(() => verifyRefreshTokenRow([row({ expires_at_matches: 0 })], EXPECTED)).toThrow('expires_at did not match')
    expect(() => verifyRefreshTokenRow([], EXPECTED)).toThrow('Failed to persist the requested refresh token: no row came back')
  })
})
