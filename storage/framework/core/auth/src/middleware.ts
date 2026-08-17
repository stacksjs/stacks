import { Auth } from './authentication'
import { requestToken } from './request-token'

/**
 * Built-in auth middleware handler
 * Validates the request's access token and sets the authenticated user on Auth
 *
 * Resolution is shared with `Auth.getBearerToken()` via `requestToken`, which
 * checks the Authorization header and then the auth cookie. This used to be a
 * second hand-rolled copy that stopped at the header, so a browser signed in
 * by cookie — the whole point of `cookie-auth.ts`, and what
 * `SocialCallbackAction` produces — was rejected here with 401 on every
 * protected route (#2306).
 */
export async function authMiddleware(request: any): Promise<void> {
  const bearerToken = requestToken(request)

  if (!bearerToken) {
    const error = new Error('No authentication token provided.') as Error & { statusCode: number }
    error.statusCode = 401
    throw error
  }

  // Get user from token (also validates the token)
  const user = await Auth.getUserFromToken(bearerToken)

  if (!user) {
    const error = new Error('Invalid or expired authentication token.') as Error & { statusCode: number }
    error.statusCode = 401
    throw error
  }

  // Set the authenticated user on Auth class (makes Auth.user() work)
  Auth.setUser(user)

  // Also store on request for request.user() access
  request._authenticatedUser = user

  // Get and store the access token for ability checks
  const accessToken = await Auth.currentAccessToken()
  request._currentAccessToken = accessToken
}

/**
 * Auth middleware object with handle method (for compatibility with middleware loader)
 */
export const authMiddlewareHandler = {
  name: 'auth',
  handle: authMiddleware,
}

/**
 * The authenticated user, for a middleware or action that needs to reason
 * about one.
 *
 * Every authorization middleware in the scaffold used to open with the same
 * line:
 *
 *     const user = request.user || request._user || request._authenticatedUser
 *
 * Two things were wrong with it. `_user` is assigned nowhere in the framework,
 * so it was a dead term. And `user` is a lazily-resolving MACRO - a function -
 * so on any request carrying it, `user` WAS the function: truthy enough to
 * pass the "is anyone signed in" check, then missing every field the caller
 * went on to read, which surfaces as a confusing 403 rather than an honest
 * 401.
 *
 * Resolving it here means every caller agrees on what "the user" is, and the
 * answer is a user rather than a callable.
 */
export async function authenticatedUser(request: any): Promise<any | undefined> {
  const cached = request?._authenticatedUser
  if (cached && typeof cached === 'object')
    return cached

  const macro = request?.user
  if (typeof macro === 'function') {
    const resolved = await macro()
    return resolved && typeof resolved === 'object' ? resolved : undefined
  }

  // A middleware upstream may have stamped a plain object on `user` instead.
  if (macro && typeof macro === 'object')
    return macro

  return undefined
}
