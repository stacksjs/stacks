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
 *
 * It is also the answer to "is this a user at all". An object with no usable
 * `id` is not one, and returning it anyway pushed the failure downstream into
 * RBAC, which validates its input and throws a TypeError — so an authorization
 * middleware answered 500 rather than 401, to signed-in and anonymous callers
 * alike. Deciding it here means every caller's own `if (!user) throw 401` is
 * the check that fires.
 */
export async function authenticatedUser(request: any): Promise<any | undefined> {
  const cached = request?._authenticatedUser
  if (isUserLike(cached))
    return cached

  const macro = request?.user
  if (typeof macro === 'function') {
    const resolved = await macro()
    return isUserLike(resolved) ? resolved : undefined
  }

  // A middleware upstream may have stamped a plain object on `user` instead.
  if (isUserLike(macro))
    return macro

  return undefined
}

/**
 * Whether a resolved value can stand in for the signed-in user.
 *
 * The id is what every authorization path goes on to key off, so a value
 * without one is rejected here rather than halfway through a role lookup.
 * Numeric ids are the framework's own shape; a string id is accepted when it
 * is non-empty, since a custom user provider may issue one.
 */
function isUserLike(value: unknown): boolean {
  if (!value || typeof value !== 'object')
    return false
  const id = (value as { id?: unknown }).id
  if (typeof id === 'number')
    return Number.isFinite(id) && id > 0
  return typeof id === 'string' && id.trim().length > 0
}
