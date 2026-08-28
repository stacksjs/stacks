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
import type { UserModel as OrmUserModel } from '@stacksjs/orm'
import { AuthorizationResponse } from './gate'

// Use the row/instance shape from orm so policies operate on the
// authenticated user object, not the User class constructor.
type UserModel = OrmUserModel

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

import type { GateAfterCallback, GateBeforeCallback, GateCallback } from './gate'
import { log } from '@stacksjs/logging'
import * as p from '@stacksjs/path'
import { policy as registerPolicy } from './gate'

/**
 * Where policies live, in override order: the application's own first, the
 * framework defaults behind it.
 */
function policyDirectories(): string[] {
  return [
    p.appPath('Policies'),
    p.storagePath('framework/defaults/app/Policies'),
  ]
}

/** Locate a policy file by name, application first. */
async function findPolicyFile(name: string): Promise<string | null> {
  const { fs } = await import('@stacksjs/storage')

  for (const dir of policyDirectories()) {
    const candidate = `${dir}/${name}.ts`
    if (fs.existsSync(candidate))
      return candidate
  }

  return null
}

/**
 * Discover and register policies: the explicit mappings in `app/Gates.ts`
 * first, then anything under `app/Policies/` that follows the `ModelPolicy`
 * convention.
 */
export async function discoverPolicies(): Promise<void> {
  const { fs } = await import('@stacksjs/storage')

  // Explicitly mapped policies first, and NOT gated on `app/Policies/`
  // existing. A mapping may name a policy that ships with the framework, and
  // returning early when the application has no policies directory of its own
  // meant those were never registered.
  const explicit = new Set<string>()

  const authorization = await loadGatesModule()
  const mappings = (authorization?.policies ?? {}) as Record<string, string | { policy: string, model?: string }>

  for (const [modelName, config] of Object.entries(mappings)) {
    const policyFile = typeof config === 'string' ? config : config.policy
    const policyPath = await findPolicyFile(policyFile)

    if (!policyPath) {
      // Said out loud. A mapping that resolves to nothing registers nothing,
      // and an unregistered policy denies every check against that model -
      // which looks exactly like a policy that means to say no.
      log.warn(`[auth] app/Gates.ts maps ${modelName} to ${policyFile}, and no such policy exists`)
      continue
    }

    try {
      const policyModule = await import(policyPath)
      const PolicyClass = policyModule.default || policyModule[policyFile]

      if (!PolicyClass) {
        log.warn(`[auth] ${policyPath} has no default export, so ${modelName} has no policy`)
        continue
      }

      registerPolicy(modelName, PolicyClass)
      explicit.add(modelName)
      log.debug(`Registered policy: ${policyFile} for ${modelName}`)
    }
    catch (error) {
      log.error(`Failed to load policy ${policyFile}:`, error)
    }
  }

  // Auto-discover policies by convention (ModelPolicy for Model)
  const policiesDir = p.appPath('Policies')
  if (!fs.existsSync(policiesDir)) {
    log.debug('No Policies directory found')
    return
  }

  const policyFiles = fs.readdirSync(policiesDir).filter((file: string) => file.endsWith('Policy.ts'))

  for (const file of policyFiles) {
    const policyName = file.replace('.ts', '')
    const modelName = policyName.replace('Policy', '')

    // Skip if already registered via Gates.ts. The comment saying so was here
    // and the check was not, so convention silently overwrote every explicit
    // mapping: `{ Post: 'CustomPostPolicy' }` registered, and was then replaced
    // by `PostPolicy` because a file of that name happened to exist.
    if (explicit.has(modelName))
      continue

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
 * Load `app/Gates.ts`, as `{ gates, policies, before, after }`.
 *
 * Returns null when the file is absent, and THROWS when it exists and cannot be
 * loaded. Both used to be swallowed into `log.debug('No Gates.ts found or
 * failed to load')`: a syntax error in `Gates.ts` disabled every gate and
 * policy in the application, silently, and the resulting behaviour - deny
 * everything - is what a working authorization layer also looks like from the
 * outside when it says no.
 */
async function loadGatesModule(): Promise<{
  gates?: Record<string, unknown>
  policies?: Record<string, unknown>
  before?: unknown[]
  after?: unknown[]
} | null> {
  const { fs } = await import('@stacksjs/storage')
  const gatesPath = p.appPath('Gates.ts')

  if (!fs.existsSync(gatesPath))
    return null

  const module = await import(gatesPath)

  // `defineGates` produces a default export; the named exports are the older
  // shape. Read both so either compiles and either works.
  return {
    gates: module.default?.gates ?? module.gates,
    policies: module.default?.policies ?? module.policies,
    before: module.default?.before ?? module.before,
    after: module.default?.after ?? module.after,
  }
}

/**
 * Register inline gates from Gates.ts
 */
export async function registerGates(): Promise<void> {
  const { define, before, after } = await import('./gate')

  const authorization = await loadGatesModule()
  if (!authorization) {
    log.debug('No Gates.ts found')
    return
  }

  for (const [ability, callback] of Object.entries(authorization.gates ?? {})) {
    if (typeof callback === 'function') {
      define(ability, callback as GateCallback)
      log.debug(`Registered gate: ${ability}`)
    }
  }

  for (const callback of authorization.before ?? []) {
    if (typeof callback === 'function')
      before(callback as GateBeforeCallback)
  }

  for (const callback of authorization.after ?? []) {
    if (typeof callback === 'function')
      after(callback as GateAfterCallback)
  }

  log.debug('Gates registered successfully')
}

/**
 * Initialize the authorization system: register the gates and before/after
 * callbacks from `app/Gates.ts`, then the policies.
 *
 * Called from `injectGlobalAutoImports()`, which is the one place every entry
 * point comes through - HTTP, `buddy seed`, a scheduled job, a console command.
 * Nothing called it before. It was exported, documented, and dead, so every
 * gate an application defined was never registered and every `Gate.allows(...)`
 * fell through to the default deny. That is the failure mode authorization is
 * least able to report, because a gate that denies everything and a gate that
 * was never registered are the same answer.
 *
 * Never throws: an application that cannot boot over a typo in a gate is worse
 * than one that logs the typo. A `Gates.ts` that fails to load is reported at
 * error level, not swallowed at debug.
 */
export async function initializeAuthorization(): Promise<void> {
  try {
    await registerGates()
  }
  catch (error) {
    log.error('[auth] app/Gates.ts failed to load - no gates are registered and every Gate check will deny:', error)
  }

  try {
    await discoverPolicies()
  }
  catch (error) {
    log.error('[auth] policy discovery failed - model authorization will deny:', error)
  }
}

export { AuthorizationResponse }
