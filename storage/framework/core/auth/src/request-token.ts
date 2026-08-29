import { authCookieToken } from './cookie'

/**
 * The access token a request carries, from the Authorization header or the
 * auth cookie.
 *
 * One function because there used to be two copies of it — `authMiddleware`
 * and `Auth.getBearerToken()` each extracted the bearer by hand, and both
 * stopped at the header. That is what made cookie auth half-real: the cookie
 * was written by `SocialCallbackAction` and read by `userFromCookie`, but the
 * middleware that actually gates routes never looked at it, so a browser
 * signed in by cookie got 401 "No authentication token provided" on every
 * protected route, and `Auth.logout()` found no token, revoked nothing, and
 * still answered 200 (#2306).
 *
 * The header is checked first, so an API client behaves exactly as before.
 */
/**
 * What this needs off a request, which is deliberately little.
 *
 * Both members are optional because the function is handed two different
 * shapes: a Stacks request, which answers `bearerToken()`, and a plain
 * `Request`, which only has headers. Written out rather than left as `any` so
 * the optional chaining below is checked against something - as `any` it was
 * indistinguishable from probing for members that do not exist on either.
 */
export interface TokenBearingRequest {
  bearerToken?: () => string | undefined | null
  headers?: Headers
}

export function requestToken(request: TokenBearingRequest | null | undefined): string | null {
  let token: string | undefined | null = request?.bearerToken?.()

  if (!token) {
    const header = request?.headers?.get?.('authorization') || request?.headers?.get?.('Authorization')
    if (typeof header === 'string' && header.startsWith('Bearer '))
      token = header.substring(7)
  }

  if (!token && request?.headers)
    token = authCookieToken({ headers: request.headers })

  return token || null
}
