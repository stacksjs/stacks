import type { UserModel } from '@stacksjs/orm'
import { defineGates } from '@stacksjs/auth'

/**
 * Authorization Gates Configuration
 *
 * Define your application's authorization gates and policy mappings here.
 * Gates provide a simple way to authorize actions, while policies
 * organize authorization logic around particular models.
 *
 * Registered at boot by `initializeAuthorization()`, which every entry point
 * comes through - HTTP, `buddy seed`, a scheduled job, a console command.
 *
 * @see https://stacksjs.org/docs/security/authorization
 */
export default defineGates({
  /**
   * Gate definitions
   *
   * Simple ability checks that don't require a model. The names below are what
   * `Gate.allows('...')` offers as completions.
   *
   * @example
   * import { Gate } from '@stacksjs/auth'
   *
   * if (await Gate.allows('edit-settings', user)) {
   *   // User can edit settings
   * }
   */
  gates: {
    /** Check if user can access admin area */
    'access-admin': (user: UserModel | null) => {
      return user?.email?.endsWith('@stacksjs.org') ?? false
    },

    /** Check if user can edit application settings */
    'edit-settings': (user: UserModel | null) => {
      // Add your logic here
      return user !== null
    },

    /** Check if user can view dashboard */
    'view-dashboard': (user: UserModel | null) => {
      return user !== null
    },

    // Add more gates here...
    // 'ability-name': (user, ...args) => boolean,
  },

  /**
   * Policy mappings
   *
   * Map model names to their policy classes. Policy files live in
   * `app/Policies/`, or in the framework defaults behind it. Both halves are
   * checked: the key names a model that exists, the value a policy that does.
   *
   * A policy whose file is named `<Model>Policy.ts` is picked up by convention
   * and does not need an entry here. An entry WINS over the convention, which
   * is the point of writing one.
   *
   * @example
   * // Simple mapping (uses PostPolicy for the Post model)
   * Post: 'PostPolicy',
   *
   * // Or with config:
   * Post: {
   *   policy: 'PostPolicy',
   *   model: 'Post',
   * },
   */
  policies: {
    // Post: 'PostPolicy',
    // User: 'UserPolicy',
    // Comment: 'CommentPolicy',
  },

  /**
   * Before callbacks
   *
   * Run before any gate/policy check. Return true to allow,
   * false to deny, or null to continue to the actual check.
   */
  before: [
    // Example: Super admin bypass
    // (user) => {
    //   if (user?.role === 'super-admin')
    //     return true // Allow everything for super admins
    //   return null // Continue to normal checks
    // },
  ],

  /**
   * After callbacks
   *
   * Run after gate/policy checks. Returning a boolean overrides the result;
   * returning nothing keeps it.
   */
  after: [
    // Example: Log all authorization checks
    // (user, ability, result) => {
    //   console.log(`User ${user?.id} ${result ? 'allowed' : 'denied'} for ${ability}`)
    // },
  ],
})
