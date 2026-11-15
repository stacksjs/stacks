import { describe, expect, it } from 'bun:test'
import { normalizeTokenExpiry, normalizeTokenScopes, scopesBeyond, wantsRefreshToken } from './token-request'

describe('personal access token requests', () => {
  it('bounds token expiry to the supported range', () => {
    expect(normalizeTokenExpiry(undefined)).toBe(60)
    expect(normalizeTokenExpiry('10080')).toBe(10080)
    expect(normalizeTokenExpiry(0)).toBeNull()
    expect(normalizeTokenExpiry(525601)).toBeNull()
  })

  it('normalizes and validates scopes', () => {
    expect(normalizeTokenScopes(['read', 'read', 'deploy:run', 'bad scope'])).toEqual([
      'read',
      'deploy:run',
    ])
    expect(normalizeTokenScopes('read,write')).toEqual(['read', 'write'])
    expect(normalizeTokenScopes(undefined)).toEqual(['*'])
  })

  it('a token cannot grant scopes it does not hold', () => {
    // The escalation this closes: a scoped token asking for full access, by
    // name or by leaving `scopes` out (which normalizes to `*`).
    expect(scopesBeyond(['deploy:run'], ['*'])).toEqual(['*'])
    expect(scopesBeyond(['deploy:run'], normalizeTokenScopes(undefined))).toEqual(['*'])
    expect(scopesBeyond(['deploy:run'], ['deploy:run', 'posts:write'])).toEqual(['posts:write'])
    expect(scopesBeyond([], ['read'])).toEqual(['read'])
    // Within what it holds, or a subset of it, is fine.
    expect(scopesBeyond(['read', 'write'], ['read'])).toEqual([])
    expect(scopesBeyond(['read', 'write'], ['write', 'read'])).toEqual([])
  })

  it('a full-access token or a cookie session may grant anything', () => {
    expect(scopesBeyond(['*'], ['*', 'anything'])).toEqual([])
    expect(scopesBeyond(null, ['*'])).toEqual([])
    expect(scopesBeyond(undefined, ['posts:write'])).toEqual([])
  })

  it('allows API clients to opt out of refresh tokens', () => {
    expect(wantsRefreshToken(undefined)).toBe(true)
    expect(wantsRefreshToken(false)).toBe(false)
    expect(wantsRefreshToken('false')).toBe(false)
  })
})
