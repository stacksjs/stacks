import type { UserModel } from '@stacksjs/orm'

/**
 * Authorization Gates Configuration
 *
 * Define your application's authorization gates and policy mappings here.
 * Gates provide a simple way to authorize actions, while policies
 * organize authorization logic around particular models.
 *
 * @see https://stacksjs.org/docs/security/authorization
 */

/**
 * Gate definitions
 *
 * Simple ability checks that don't require a model.
 *
 * @example
 * // In your code:
 * import { Gate } from '@stacksjs/auth'
 *
 * if (await Gate.allows('edit-settings', user)) {
 *   // User can edit settings
 * }
 */
export const gates = {
  /**
   * Check if user can access admin area
   */
  'access-admin': (user: UserModel | null) => {
    return user?.email?.endsWith('@stacksjs.org') ?? false
  },

  /**
   * Check if user can edit application settings
   */
  'edit-settings': (user: UserModel | null) => {
    // Add your logic here
    return user !== null
  },

  /**
   * Check if user can view dashboard
   */
  'view-dashboard': (user: UserModel | null) => {
    return user !== null
  },

  // Add more gates here...
  // 'ability-name': (user, ...args) => boolean,
}

/**
 * Policy mappings
 *
 * Map model names to their policy classes.
 * Policy files should be in app/Policies/ directory.
 *
 * @example
 * // Simple mapping (uses PostPolicy for Post model)
 * 'Post': 'PostPolicy',
 *
 * // Or with config:
 * 'Post': {
 *   policy: 'PostPolicy',
 *   model: 'Post',
 * },
 */
export const policies: Record<string, string | { policy: string, model?: string }> = {
  // 'Post': 'PostPolicy',
  // 'User': 'UserPolicy',
  // 'Comment': 'CommentPolicy',
}

/**
 * Before callbacks
 *
 * Run before any gate/policy check. Return true to allow,
 * false to deny, or null to continue to the actual check.
 *
 * @example
 * // Super admins bypass all checks
 * (user) => user?.role === 'super-admin' ? true : null
 */
export const before: Array<(user: UserModel | null, ability: string, args: any[]) => boolean | null | Promise<boolean | null>> = [
  // Example: Super admin bypass
  // (user, ability) => {
  //   if (user?.role === 'super-admin') {
  //     return true // Allow everything for super admins
  //   }
  //   return null // Continue to normal checks
  // },
]

/**
 * After callbacks
 *
 * Run after gate/policy checks. Can override the result.
 */
export const after: Array<(user: UserModel | null, ability: string, result: boolean, args: any[]) => boolean | void | Promise<boolean | void>> = [
  // Example: Log all authorization checks
  // (user, ability, result) => {
  //   console.log(`User ${user?.id} ${result ? 'allowed' : 'denied'} for ${ability}`)
  // },
]

export default { gates, policies, before, after }
