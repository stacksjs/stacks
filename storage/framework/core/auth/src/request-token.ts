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
export function requestToken(request: any): string | null {
  let token: string | undefined | null = request?.bearerToken?.()

  if (!token) {
    const header = request?.headers?.get?.('authorization') || request?.headers?.get?.('Authorization')
    if (typeof header === 'string' && header.startsWith('Bearer '))
      token = header.substring(7)
  }

  if (!token && request?.headers)
    token = authCookieToken(request as { headers: Headers })

  return token || null
}
