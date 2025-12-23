import { Auth } from './authentication'

/**
 * Built-in auth middleware handler
 * Validates bearer token and sets the authenticated user on Auth
 */
export async function authMiddleware(request: any): Promise<void> {
  console.log('[auth middleware] Starting authentication...')

  // Try multiple ways to get the bearer token
  let bearerToken = request.bearerToken?.()
  console.log('[auth middleware] bearerToken() result:', bearerToken ? 'found' : 'null')

  // Fallback: get directly from Authorization header
  if (!bearerToken) {
    const authHeader = request.headers?.get?.('authorization') || request.headers?.get?.('Authorization')
    console.log('[auth middleware] Fallback to header:', authHeader ? 'found' : 'null')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.substring(7)
    }
  }

  if (!bearerToken) {
    console.log('[auth middleware] No token found, throwing 401')
    const error = new Error('No authentication token provided.') as Error & { statusCode: number }
    error.statusCode = 401
    throw error
  }

  console.log('[auth middleware] Token found, validating...')

  // Get user from token (also validates the token)
  const user = await Auth.getUserFromToken(bearerToken)
  console.log('[auth middleware] User from token:', user ? `ID: ${user.id}` : 'null')

  if (!user) {
    console.log('[auth middleware] Invalid token, throwing 401')
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

  console.log('[auth middleware] Authentication successful for user:', user.id)
}

/**
 * Auth middleware object with handle method (for compatibility with middleware loader)
 */
export const authMiddlewareHandler = {
  name: 'auth',
  handle: authMiddleware,
}
