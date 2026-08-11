/**
 * How a request's access token is found.
 *
 * The bug these pin (#2306): `authMiddleware` and `Auth.getBearerToken()` each
 * hand-rolled this and both stopped at the Authorization header. A browser
 * signed in by cookie — which is what `SocialCallbackAction` produces, and the
 * entire reason `cookie-auth.ts` exists — was therefore rejected with 401 on
 * every protected route, and `Auth.logout()` found no token, revoked nothing,
 * and still answered 200.
 */
import { describe, expect, it } from 'bun:test'
import { authCookie } from '../src/cookie'
import { requestToken } from '../src/request-token'

/** The header shape a browser actually sends back for a Set-Cookie. */
function cookieHeader(token: string): string {
  return authCookie(token).split(';')[0]!
}

function requestWith(headers: Record<string, string>): Request {
  return new Request('https://example.com/', { headers })
}

describe('requestToken', () => {
  it('reads a bearer token from the Authorization header', () => {
    expect(requestToken(requestWith({ authorization: 'Bearer abc123' }))).toBe('abc123')
  })

  it('reads the auth cookie when there is no Authorization header', () => {
    // The case that was returning null. A browser following a redirect cannot
    // set a header, so this is the only credential a server-rendered page has.
    expect(requestToken(requestWith({ cookie: cookieHeader('abc123') }))).toBe('abc123')
  })

  it('prefers the header when a request carries both', () => {
    // Keeps an API client behaving exactly as before, and makes the cookie a
    // fallback rather than an override.
    const request = requestWith({
      authorization: 'Bearer from-header',
      cookie: cookieHeader('from-cookie'),
    })

    expect(requestToken(request)).toBe('from-header')
  })

  it('ignores an Authorization header that is not a bearer token', () => {
    const request = requestWith({
      authorization: 'Basic dXNlcjpwYXNz',
      cookie: cookieHeader('from-cookie'),
    })

    expect(requestToken(request)).toBe('from-cookie')
  })

  it('returns null when the request carries no credential at all', () => {
    expect(requestToken(requestWith({}))).toBeNull()
    expect(requestToken(requestWith({ cookie: 'theme=dark' }))).toBeNull()
  })

  it('survives a request object without headers rather than throwing', () => {
    // `Auth.getBearerToken()` runs against the ambient request, which outside a
    // request scope is not a Request at all.
    expect(requestToken({})).toBeNull()
    expect(requestToken(undefined)).toBeNull()
  })

  it('prefers an explicit bearerToken() when the request exposes one', () => {
    const request = {
      bearerToken: () => 'from-method',
      headers: new Headers({ cookie: cookieHeader('from-cookie') }),
    }

    expect(requestToken(request)).toBe('from-method')
  })
})
