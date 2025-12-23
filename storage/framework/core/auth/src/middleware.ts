import { Auth } from './authentication'

/**
 * Built-in auth middleware handler
 * Validates bearer token and sets the authenticated user on Auth
 */
export async function authMiddleware(request: any): Promise<void> {
  // Try to get bearer token from request method
  let bearerToken = request.bearerToken?.()

  // Fallback: get directly from Authorization header
  if (!bearerToken) {
    const authHeader = request.headers?.get?.('authorization') || request.headers?.get?.('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.substring(7)
    }
  }

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
