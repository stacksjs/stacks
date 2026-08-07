import { describe, expect, it } from 'bun:test'
import { authCookie, authCookieToken, clearAuthCookie } from '../src/cookie-auth'

/** A request carrying the given Cookie header, which is all these read. */
function requestWith(cookie: string): Request {
  return new Request('https://example.com/', { headers: { cookie } })
}

describe('authCookie', () => {
  it('carries the token and the attributes a session needs', () => {
    const cookie = authCookie('abc123')

    expect(cookie).toContain('auth-token=abc123')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toMatch(/Max-Age=\d+/)
  })

  it('defaults its lifetime to the configured token expiry, in seconds', () => {
    // config.auth.tokenExpiry is milliseconds (one hour by default); a cookie
    // that outlived its token would leave the browser sending a dead session.
    const maxAge = Number(/Max-Age=(\d+)/.exec(authCookie('abc123'))?.[1])

    expect(maxAge).toBeGreaterThanOrEqual(60)
    expect(maxAge).toBeLessThanOrEqual(60 * 60 * 24 * 400)
  })

  it('honours an explicit name, path, domain and lifetime', () => {
    const cookie = authCookie('abc123', {
      name: 'of_session',
      path: '/account',
      domain: 'openfarm.ing',
      maxAge: 900,
    })

    expect(cookie).toContain('of_session=abc123')
    expect(cookie).toContain('Path=/account')
    expect(cookie).toContain('Domain=openfarm.ing')
    expect(cookie).toContain('Max-Age=900')
  })

  it('can be forced insecure for plain-HTTP development', () => {
    expect(authCookie('abc123', { secure: false })).not.toContain('Secure')
    expect(authCookie('abc123', { secure: true })).toContain('Secure')
  })

  it('percent-encodes a token containing cookie separators', () => {
    const cookie = authCookie('12|plain;text value')

    expect(cookie).toContain('auth-token=12%7Cplain%3Btext%20value')
    // The separators must not survive into the header, or the cookie splits.
    expect(cookie.split(';')[0]).not.toContain('plain;')
  })
})

describe('clearAuthCookie', () => {
  it('expires the cookie while keeping its identity', () => {
    const cleared = clearAuthCookie({ name: 'of_session', path: '/account' })

    expect(cleared).toContain('of_session=')
    expect(cleared).toContain('Max-Age=0')
    // Path has to match or the browser keeps the original alongside it.
    expect(cleared).toContain('Path=/account')
  })
})

describe('authCookieToken', () => {
  it('finds its cookie among others', () => {
    const token = authCookieToken(requestWith('theme=dark; auth-token=abc123; locale=de'))
    expect(token).toBe('abc123')
  })

  it('round-trips a token with separators in it', () => {
    const value = '12|plain;text value'
    const header = authCookie(value).split(';')[0]!

    expect(authCookieToken(requestWith(header))).toBe(value)
  })

  it('returns undefined when there is no cookie, no match, or an empty value', () => {
    expect(authCookieToken(new Request('https://example.com/'))).toBeUndefined()
    expect(authCookieToken(requestWith('theme=dark'))).toBeUndefined()
    expect(authCookieToken(requestWith('auth-token='))).toBeUndefined()
  })

  it('does not match a cookie whose name merely ends with the wanted one', () => {
    expect(authCookieToken(requestWith('other_auth-token=abc123'))).toBeUndefined()
  })
})
