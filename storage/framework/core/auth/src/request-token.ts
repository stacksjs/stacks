import { parseBearerToken } from '@stacksjs/bun-router'
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

  // Read case-insensitively, as the CSRF check reads it. Requiring exactly
  // `Bearer ` meant `bearer abc` carried no token, so this fell through to
  // the auth cookie - for a request CSRF had exempted as token-authenticated.
  const header = request?.headers?.get?.('authorization') ?? null
  if (!token)
    token = parseBearerToken(header)

  // An Authorization header that names a bearer token decides, even when the
  // token is bad: it is never traded for the cookie beside it.
  if (!token && request?.headers && !/^\s*bearer\b/i.test(header ?? ''))
    token = authCookieToken({ headers: request.headers })

  return token || null
}
