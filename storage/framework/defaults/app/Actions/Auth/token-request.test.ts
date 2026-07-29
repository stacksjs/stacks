import { describe, expect, it } from 'bun:test'
import { normalizeTokenExpiry, normalizeTokenScopes, wantsRefreshToken } from './token-request'

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

  it('allows API clients to opt out of refresh tokens', () => {
    expect(wantsRefreshToken(undefined)).toBe(true)
    expect(wantsRefreshToken(false)).toBe(false)
    expect(wantsRefreshToken('false')).toBe(false)
  })
})
