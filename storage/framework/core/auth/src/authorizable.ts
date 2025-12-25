/**
 * User Authorization Helpers
 *
 * These functions provide Laravel-like authorization methods for users.
 * Use them with any user object or import them as helpers.
 *
 * @example
 * import { userCan, userCannot } from '@stacksjs/auth'
 *
 * if (await userCan(user, 'update', post)) {
 *   // User can update the post
 * }
 */

import type { UserModel } from '@stacksjs/orm'
import { can, cannot, any, all, authorize as gateAuthorize, inspect } from './gate'
import type { AuthorizationResponse } from './gate'

/**
 * Check if a user can perform an ability
 *
 * @example
 * if (await userCan(user, 'edit-settings')) { ... }
 * if (await userCan(user, 'update', post)) { ... }
 */
export async function userCan(user: UserModel | null, ability: string, ...args: any[]): Promise<boolean> {
  return can(ability, user, ...args)
}

/**
 * Check if a user cannot perform an ability
 *
 * @example
 * if (await userCannot(user, 'delete', post)) { ... }
 */
export async function userCannot(user: UserModel | null, ability: string, ...args: any[]): Promise<boolean> {
  return cannot(ability, user, ...args)
}

/**
 * Check if a user can perform any of the given abilities
 *
 * @example
 * if (await userCanAny(user, ['update', 'delete'], post)) { ... }
 */
export async function userCanAny(user: UserModel | null, abilities: string[], ...args: any[]): Promise<boolean> {
  return any(abilities, user, ...args)
}

/**
 * Check if a user can perform all of the given abilities
 *
 * @example
 * if (await userCanAll(user, ['view', 'update'], post)) { ... }
 */
export async function userCanAll(user: UserModel | null, abilities: string[], ...args: any[]): Promise<boolean> {
  return all(abilities, user, ...args)
}

/**
 * Authorize a user or throw an exception
 *
 * @example
 * await authorizeUser(user, 'update', post) // Throws if not allowed
 */
export async function authorizeUser(user: UserModel | null, ability: string, ...args: any[]): Promise<AuthorizationResponse> {
  return gateAuthorize(ability, user, ...args)
}

/**
 * Get detailed authorization result
 *
 * @example
 * const result = await inspectUser(user, 'update', post)
 * if (result.denied()) {
 *   console.log(result.message)
 * }
 */
export async function inspectUser(user: UserModel | null, ability: string, ...args: any[]): Promise<AuthorizationResponse> {
  return inspect(ability, user, ...args)
}

/**
 * Authorizable trait for user models
 *
 * Add authorization methods to a user object
 *
 * @example
 * const authorizedUser = withAuthorization(user)
 * if (await authorizedUser.can('update', post)) { ... }
 */
export function withAuthorization<T extends UserModel>(user: T): T & AuthorizableMethods {
  return Object.assign(user, {
    can: (ability: string, ...args: any[]) => userCan(user, ability, ...args),
    cannot: (ability: string, ...args: any[]) => userCannot(user, ability, ...args),
    canAny: (abilities: string[], ...args: any[]) => userCanAny(user, abilities, ...args),
    canAll: (abilities: string[], ...args: any[]) => userCanAll(user, abilities, ...args),
    authorize: (ability: string, ...args: any[]) => authorizeUser(user, ability, ...args),
  })
}

/**
 * Authorization methods interface
 */
export interface AuthorizableMethods {
  can(ability: string, ...args: any[]): Promise<boolean>
  cannot(ability: string, ...args: any[]): Promise<boolean>
  canAny(abilities: string[], ...args: any[]): Promise<boolean>
  canAll(abilities: string[], ...args: any[]): Promise<boolean>
  authorize(ability: string, ...args: any[]): Promise<AuthorizationResponse>
}

/**
 * Type for a user with authorization methods
 */
export type AuthorizableUser<T extends UserModel> = T & AuthorizableMethods
