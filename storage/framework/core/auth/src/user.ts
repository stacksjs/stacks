import type { UserJsonResponse, UserModel } from '@stacksjs/orm'
import { request } from '@stacksjs/router'
import { Auth } from './authentication'

export type AuthUser = UserJsonResponse

/**
 * Get the currently authenticated user
 *
 * This is the primary way to get the authenticated user in your application.
 * It first checks if the user was already set by the auth middleware,
 * then falls back to validating the bearer token.
 *
 * @example
 * import { authUser } from '@stacksjs/auth'
 *
 * const user = await authUser()
 * if (user) {
 *   console.log('Logged in as:', user.email)
 * }
 */
export async function authUser(): Promise<UserModel | undefined> {
  // First check if already set by middleware (fastest path)
  const middlewareUser = (request as any)?._authenticatedUser
  if (middlewareUser) {
    return middlewareUser
  }

  // Fall back to token validation
  let token = request.bearerToken?.()

  // Fallback: get directly from Authorization header
  if (!token) {
    const authHeader = request.headers?.get?.('authorization') || request.headers?.get?.('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }
  }

  if (!token) {
    return undefined
  }

  return await Auth.getUserFromToken(token)
}

/**
 * Alias for authUser() - for backwards compatibility
 * @deprecated Use authUser() instead
 */
export async function getCurrentUser(): Promise<UserModel | undefined> {
  return authUser()
}

export async function check(): Promise<boolean> {
  return !!(await authUser())
}

export async function id(): Promise<number | undefined> {
  return (await authUser())?.id
}

export async function email(): Promise<string | undefined> {
  return (await authUser())?.email
}

export async function name(): Promise<string | undefined> {
  return (await authUser())?.name
}

export async function isAuthenticated(): Promise<boolean> {
  return await check()
}

export async function logout(): Promise<void> {
  await Auth.logout()
}

export async function refresh(): Promise<void> {
  // Clear the cached user on the request to force re-fetch
  if ((request as any)?._authenticatedUser) {
    (request as any)._authenticatedUser = undefined
  }
}
