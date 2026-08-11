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
