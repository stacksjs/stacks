import type { User } from '@stacksjs/orm'
import { request } from '@stacksjs/router'
import { Auth } from './authentication'

/**
 * The signed-in user: the row `User.find` returns, so an app's own User model
 * and its columns come through. It is what `Auth.user()` resolves, what the
 * Auth middleware stamps on `request._authenticatedUser`, and what `Gate`,
 * policies and the RBAC helpers receive (stacksjs/stacks#3314).
 */
export type AuthUser = NonNullable<Awaited<ReturnType<typeof User.find>>>

/**
 * Get the currently authenticated user
 *
 * This is the primary way to get the authenticated user in your application.
 * It first checks if the user was already set by the auth middleware,
 * then resolves the request's bearer token, auth cookie, or database session.
 *
 * @example
 * import { authUser } from '@stacksjs/auth'
 *
 * const user = await authUser()
 * if (user) {
 *   console.log('Logged in as:', user.email)
 * }
 */
export async function authUser(): Promise<AuthUser | undefined> {
  // First check if already set by middleware (fastest path).
  const middlewareUser = request?._authenticatedUser
  if (middlewareUser) {
    return middlewareUser
  }

  return await Auth.user()
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
  // Both public lookup paths share the request-scoped Auth cache.
  Auth.setUser(undefined)
  if (request?._authenticatedUser) {
    request._authenticatedUser = undefined
  }
}
