/**
 * Authorization Gate System
 *
 * Laravel-like authorization gates for fine-grained access control.
 * Supports both inline gates and policy classes.
 */

import type { UserModel } from '@stacksjs/orm'

/**
 * Gate callback function type
 */
export type GateCallback<T = any> = (user: UserModel | null, ...args: T[]) => boolean | Promise<boolean> | AuthorizationResponse

/**
 * Policy method type
 */
export type PolicyMethod<T = any> = (user: UserModel | null, model?: T, ...args: any[]) => boolean | Promise<boolean> | AuthorizationResponse

/**
 * Authorization response for detailed allow/deny
 */
export class AuthorizationResponse {
  constructor(
    public readonly allowed: boolean,
    public readonly message?: string,
    public readonly code?: string,
  ) {}

  static allow(message?: string): AuthorizationResponse {
    return new AuthorizationResponse(true, message)
  }

  static deny(message?: string, code?: string): AuthorizationResponse {
    return new AuthorizationResponse(false, message || 'This action is unauthorized.', code)
  }

  allowed(): boolean {
    return this.allowed
  }

  denied(): boolean {
    return !this.allowed
  }

  authorize(): void {
    if (!this.allowed) {
      throw new AuthorizationException(this.message || 'This action is unauthorized.', this.code)
    }
  }
}

/**
 * Authorization exception
 */
export class AuthorizationException extends Error {
  constructor(
    message: string = 'This action is unauthorized.',
    public readonly code?: string,
    public readonly status: number = 403,
  ) {
    super(message)
    this.name = 'AuthorizationException'
  }
}

/**
 * Policy class interface
 */
export interface Policy<T = any> {
  /** Called before any other policy method */
  before?(user: UserModel | null, ability: string): boolean | null | Promise<boolean | null>

  /** View any records */
  viewAny?(user: UserModel | null): boolean | Promise<boolean> | AuthorizationResponse

  /** View a specific record */
  view?(user: UserModel | null, model: T): boolean | Promise<boolean> | AuthorizationResponse

  /** Create new records */
  create?(user: UserModel | null): boolean | Promise<boolean> | AuthorizationResponse

  /** Update a specific record */
  update?(user: UserModel | null, model: T): boolean | Promise<boolean> | AuthorizationResponse

  /** Delete a specific record */
  delete?(user: UserModel | null, model: T): boolean | Promise<boolean> | AuthorizationResponse

  /** Restore a soft-deleted record */
  restore?(user: UserModel | null, model: T): boolean | Promise<boolean> | AuthorizationResponse

  /** Permanently delete a record */
  forceDelete?(user: UserModel | null, model: T): boolean | Promise<boolean> | AuthorizationResponse

  /** Any custom ability methods */
  [key: string]: PolicyMethod | undefined
}

/**
 * Gate registry state
 */
interface GateState {
  gates: Map<string, GateCallback>
  policies: Map<string, new () => Policy>
  beforeCallbacks: Array<(user: UserModel | null, ability: string, args: any[]) => boolean | null | Promise<boolean | null>>
  afterCallbacks: Array<(user: UserModel | null, ability: string, result: boolean, args: any[]) => boolean | void | Promise<boolean | void>>
}

const state: GateState = {
  gates: new Map(),
  policies: new Map(),
  beforeCallbacks: [],
  afterCallbacks: [],
}

/**
 * Define a new authorization gate
 *
 * @example
 * define('edit-settings', (user) => user?.isAdmin)
 * define('update-post', (user, post) => user?.id === post.userId)
 */
export function define<T = any>(ability: string, callback: GateCallback<T>): void {
  state.gates.set(ability, callback)
}

/**
 * Register a policy for a model
 *
 * @example
 * policy('Post', PostPolicy)
 * policy(Post, PostPolicy)
 */
export function policy(model: string | { name: string }, policyClass: new () => Policy): void {
  const modelName = typeof model === 'string' ? model : model.name
  state.policies.set(modelName, policyClass)
}

/**
 * Register a callback to run before all gate checks
 *
 * @example
 * before((user, ability) => {
 *   if (user?.isSuperAdmin) return true // Super admins can do anything
 *   return null // Continue to normal checks
 * })
 */
export function before(callback: (user: UserModel | null, ability: string, args: any[]) => boolean | null | Promise<boolean | null>): void {
  state.beforeCallbacks.push(callback)
}

/**
 * Register a callback to run after all gate checks
 */
export function after(callback: (user: UserModel | null, ability: string, result: boolean, args: any[]) => boolean | void | Promise<boolean | void>): void {
  state.afterCallbacks.push(callback)
}

/**
 * Check if the user is allowed to perform an ability
 *
 * @example
 * if (await allows('edit-settings', user)) { ... }
 * if (await allows('update', user, post)) { ... }
 */
export async function allows(ability: string, user: UserModel | null, ...args: any[]): Promise<boolean> {
  return check(ability, user, ...args)
}

/**
 * Check if the user is denied from performing an ability
 *
 * @example
 * if (await denies('delete', user, post)) { ... }
 */
export async function denies(ability: string, user: UserModel | null, ...args: any[]): Promise<boolean> {
  return !(await check(ability, user, ...args))
}

/**
 * Check if the user can perform an ability (alias for allows)
 */
export async function can(ability: string, user: UserModel | null, ...args: any[]): Promise<boolean> {
  return check(ability, user, ...args)
}

/**
 * Check if the user cannot perform an ability (alias for denies)
 */
export async function cannot(ability: string, user: UserModel | null, ...args: any[]): Promise<boolean> {
  return !(await check(ability, user, ...args))
}

/**
 * Check if the user can perform any of the given abilities
 *
 * @example
 * if (await any(['update', 'delete'], user, post)) { ... }
 */
export async function any(abilities: string[], user: UserModel | null, ...args: any[]): Promise<boolean> {
  for (const ability of abilities) {
    if (await check(ability, user, ...args)) {
      return true
    }
  }
  return false
}

/**
 * Check if the user can perform all of the given abilities
 *
 * @example
 * if (await all(['view', 'update'], user, post)) { ... }
 */
export async function all(abilities: string[], user: UserModel | null, ...args: any[]): Promise<boolean> {
  for (const ability of abilities) {
    if (!(await check(ability, user, ...args))) {
      return false
    }
  }
  return true
}

/**
 * Check if the user can perform none of the given abilities
 */
export async function none(abilities: string[], user: UserModel | null, ...args: any[]): Promise<boolean> {
  return !(await any(abilities, user, ...args))
}

/**
 * Authorize an ability or throw an exception
 *
 * @example
 * await authorize('update', user, post) // Throws if not allowed
 */
export async function authorize(ability: string, user: UserModel | null, ...args: any[]): Promise<AuthorizationResponse> {
  const result = await inspect(ability, user, ...args)

  if (!result.allowed) {
    throw new AuthorizationException(result.message, result.code)
  }

  return result
}

/**
 * Get detailed inspection result for an ability check
 */
export async function inspect(ability: string, user: UserModel | null, ...args: any[]): Promise<AuthorizationResponse> {
  // Run before callbacks
  for (const callback of state.beforeCallbacks) {
    const beforeResult = await callback(user, ability, args)
    if (beforeResult === true) {
      return AuthorizationResponse.allow()
    }
    if (beforeResult === false) {
      return AuthorizationResponse.deny()
    }
    // null means continue checking
  }

  // Check for policy first (if model is passed)
  const model = args[0]
  if (model && typeof model === 'object') {
    const modelName = model.constructor?.name
    const policyClass = state.policies.get(modelName)

    if (policyClass) {
      const policyInstance = new policyClass()

      // Check policy's before method
      if (policyInstance.before) {
        const beforeResult = await policyInstance.before(user, ability)
        if (beforeResult === true) {
          return AuthorizationResponse.allow()
        }
        if (beforeResult === false) {
          return AuthorizationResponse.deny()
        }
      }

      // Check policy method
      const method = policyInstance[ability] as PolicyMethod | undefined
      if (method) {
        const result = await method.call(policyInstance, user, ...args)
        return normalizeResponse(result)
      }
    }
  }

  // Check inline gate
  const gate = state.gates.get(ability)
  if (gate) {
    const result = await gate(user, ...args)
    const response = normalizeResponse(result)

    // Run after callbacks
    for (const callback of state.afterCallbacks) {
      const afterResult = await callback(user, ability, response.allowed, args)
      if (typeof afterResult === 'boolean') {
        return afterResult ? AuthorizationResponse.allow() : AuthorizationResponse.deny()
      }
    }

    return response
  }

  // No gate or policy found - deny by default
  return AuthorizationResponse.deny(`No gate or policy defined for ability: ${ability}`)
}

/**
 * Core check implementation
 */
async function check(ability: string, user: UserModel | null, ...args: any[]): Promise<boolean> {
  const response = await inspect(ability, user, ...args)
  return response.allowed
}

/**
 * Normalize a gate/policy result to AuthorizationResponse
 */
function normalizeResponse(result: boolean | AuthorizationResponse): AuthorizationResponse {
  if (result instanceof AuthorizationResponse) {
    return result
  }
  return result ? AuthorizationResponse.allow() : AuthorizationResponse.deny()
}

/**
 * Get a policy instance for a model
 */
export function getPolicyFor<T = any>(model: T): Policy<T> | null {
  if (!model || typeof model !== 'object') {
    return null
  }

  const modelName = (model as any).constructor?.name
  const policyClass = state.policies.get(modelName)

  if (policyClass) {
    return new policyClass() as Policy<T>
  }

  return null
}

/**
 * Check if a gate is defined
 */
export function has(ability: string): boolean {
  return state.gates.has(ability)
}

/**
 * Check if a policy is registered for a model
 */
export function hasPolicy(model: string | { name: string }): boolean {
  const modelName = typeof model === 'string' ? model : model.name
  return state.policies.has(modelName)
}

/**
 * Get all defined gate names
 */
export function abilities(): string[] {
  return Array.from(state.gates.keys())
}

/**
 * Clear all gates and policies (useful for testing)
 */
export function flush(): void {
  state.gates.clear()
  state.policies.clear()
  state.beforeCallbacks = []
  state.afterCallbacks = []
}

/**
 * Gate facade for convenient access
 */
export const Gate = {
  define,
  policy,
  before,
  after,
  allows,
  denies,
  can,
  cannot,
  any,
  all,
  none,
  authorize,
  inspect,
  has,
  hasPolicy,
  abilities,
  getPolicyFor,
  flush,
  AuthorizationResponse,
  AuthorizationException,
}

export default Gate
