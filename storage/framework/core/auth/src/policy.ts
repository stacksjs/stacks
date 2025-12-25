/**
 * Base Policy Class
 *
 * Extend this class to create model-specific authorization policies.
 *
 * @example
 * export class PostPolicy extends BasePolicy<Post> {
 *   viewAny(user: UserModel | null): boolean {
 *     return true // Anyone can view posts list
 *   }
 *
 *   view(user: UserModel | null, post: Post): boolean {
 *     return post.published || user?.id === post.userId
 *   }
 *
 *   create(user: UserModel | null): boolean {
 *     return user !== null
 *   }
 *
 *   update(user: UserModel | null, post: Post): boolean {
 *     return user?.id === post.userId
 *   }
 *
 *   delete(user: UserModel | null, post: Post): boolean {
 *     return user?.id === post.userId || user?.isAdmin
 *   }
 * }
 */

import type { UserModel } from '@stacksjs/orm'
import { AuthorizationResponse } from './gate'

export abstract class BasePolicy<T = any> {
  /**
   * Perform pre-authorization checks.
   * Return true to allow, false to deny, or null to continue to specific method.
   *
   * @example
   * before(user: UserModel | null, ability: string): boolean | null {
   *   // Super admins can do everything
   *   if (user?.role === 'super-admin') {
   *     return true
   *   }
   *   return null // Continue to specific checks
   * }
   */
  before?(user: UserModel | null, ability: string): boolean | null | Promise<boolean | null>

  /**
   * Determine if the user can view any models.
   */
  viewAny?(user: UserModel | null): boolean | Promise<boolean> | AuthorizationResponse

  /**
   * Determine if the user can view the model.
   */
  view?(user: UserModel | null, model: T): boolean | Promise<boolean> | AuthorizationResponse

  /**
   * Determine if the user can create models.
   */
  create?(user: UserModel | null): boolean | Promise<boolean> | AuthorizationResponse

  /**
   * Determine if the user can update the model.
   */
  update?(user: UserModel | null, model: T): boolean | Promise<boolean> | AuthorizationResponse

  /**
   * Determine if the user can delete the model.
   */
  delete?(user: UserModel | null, model: T): boolean | Promise<boolean> | AuthorizationResponse

  /**
   * Determine if the user can restore the model (soft deletes).
   */
  restore?(user: UserModel | null, model: T): boolean | Promise<boolean> | AuthorizationResponse

  /**
   * Determine if the user can permanently delete the model.
   */
  forceDelete?(user: UserModel | null, model: T): boolean | Promise<boolean> | AuthorizationResponse

  /**
   * Helper to allow an action with optional message
   */
  protected allow(message?: string): AuthorizationResponse {
    return AuthorizationResponse.allow(message)
  }

  /**
   * Helper to deny an action with optional message
   */
  protected deny(message?: string, code?: string): AuthorizationResponse {
    return AuthorizationResponse.deny(message, code)
  }

  /**
   * Helper to deny if condition is true
   */
  protected denyIf(condition: boolean, message?: string): AuthorizationResponse | boolean {
    if (condition) {
      return this.deny(message)
    }
    return true
  }

  /**
   * Helper to deny unless condition is true
   */
  protected denyUnless(condition: boolean, message?: string): AuthorizationResponse | boolean {
    if (!condition) {
      return this.deny(message)
    }
    return true
  }

  /**
   * Helper to allow if condition is true
   */
  protected allowIf(condition: boolean, message?: string): AuthorizationResponse | boolean {
    if (condition) {
      return this.allow(message)
    }
    return false
  }
}

/**
 * Policy discovery and registration
 */

import { log } from '@stacksjs/logging'
import * as p from '@stacksjs/path'
import { policy as registerPolicy } from './gate'

interface PolicyMapping {
  [modelName: string]: string | { policy: string, model?: string }
}

/**
 * Discover and register policies from app/Policies directory
 */
export async function discoverPolicies(): Promise<void> {
  const { fs } = await import('@stacksjs/storage')
  const policiesDir = p.appPath('Policies')

  // Check if policies directory exists
  if (!fs.existsSync(policiesDir)) {
    log.debug('No Policies directory found')
    return
  }

  // Try to load Gates.ts for explicit mappings first
  try {
    const gatesPath = p.appPath('Gates.ts')
    const gatesImport = await import(gatesPath)
    const mappings: PolicyMapping = gatesImport.policies || {}

    for (const [modelName, config] of Object.entries(mappings)) {
      const policyFile = typeof config === 'string' ? config : config.policy
      const policyPath = `${policiesDir}/${policyFile}.ts`

      if (fs.existsSync(policyPath)) {
        const policyModule = await import(policyPath)
        const PolicyClass = policyModule.default || policyModule[policyFile]

        if (PolicyClass) {
          registerPolicy(modelName, PolicyClass)
          log.debug(`Registered policy: ${policyFile} for ${modelName}`)
        }
      }
    }
  }
  catch {
    log.debug('No Gates.ts found, using convention-based discovery')
  }

  // Auto-discover policies by convention (ModelPolicy for Model)
  const policyFiles = fs.readdirSync(policiesDir).filter((file: string) => file.endsWith('Policy.ts'))

  for (const file of policyFiles) {
    const policyName = file.replace('.ts', '')
    const modelName = policyName.replace('Policy', '')

    // Skip if already registered via Gates.ts
    const policyPath = `${policiesDir}/${file}`

    try {
      const policyModule = await import(policyPath)
      const PolicyClass = policyModule.default || policyModule[policyName]

      if (PolicyClass) {
        registerPolicy(modelName, PolicyClass)
        log.debug(`Auto-discovered policy: ${policyName} for ${modelName}`)
      }
    }
    catch (error) {
      log.error(`Failed to load policy ${policyName}:`, error)
    }
  }
}

/**
 * Register inline gates from Gates.ts
 */
export async function registerGates(): Promise<void> {
  const { define, before, after } = await import('./gate')

  try {
    const gatesPath = p.appPath('Gates.ts')
    const gatesModule = await import(gatesPath)

    // Register gates
    const gates = gatesModule.gates || gatesModule.default?.gates || {}
    for (const [ability, callback] of Object.entries(gates)) {
      if (typeof callback === 'function') {
        define(ability, callback as any)
        log.debug(`Registered gate: ${ability}`)
      }
    }

    // Register before callbacks
    const beforeCallbacks = gatesModule.before || gatesModule.default?.before || []
    for (const callback of beforeCallbacks) {
      if (typeof callback === 'function') {
        before(callback)
      }
    }

    // Register after callbacks
    const afterCallbacks = gatesModule.after || gatesModule.default?.after || []
    for (const callback of afterCallbacks) {
      if (typeof callback === 'function') {
        after(callback)
      }
    }

    log.debug('Gates registered successfully')
  }
  catch {
    log.debug('No Gates.ts found or failed to load')
  }
}

/**
 * Initialize authorization system
 */
export async function initializeAuthorization(): Promise<void> {
  await registerGates()
  await discoverPolicies()
}

export { AuthorizationResponse }
