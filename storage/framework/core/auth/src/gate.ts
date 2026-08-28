/**
 * Authorization Gate System
 *
 * Laravel-like authorization gates for fine-grained access control.
 * Supports both inline gates and policy classes.
 */
import type { UserModel as OrmUserModel } from '@stacksjs/orm'

// Alias the ORM-derived UserModel under the name this module uses internally.
// The gate API receives authenticated user objects (rows / instances),
// not the User class constructor.
type UserModel = OrmUserModel

/**
 * Gate callback function type
 */
export type GateCallback<T = any> = (_user: UserModel | null, ..._args: T[]) => boolean | Promise<boolean> | AuthorizationResponse

/**
 * Augmentation target: the ability names this application's own gates define.
 *
 * Derived from `app/Gates.ts` itself by
 * `storage/framework/types/gates.d.ts`, so it cannot drift from the file it
 * describes - the gates are the declaration.
 *
 * @example
 * ```ts
 * declare module '@stacksjs/auth' {
 *   interface AppGates {
 *     'access-admin': true
 *   }
 * }
 * ```
 */
// eslint-disable-next-line ts/no-empty-object-type -- augmentation target; empty by design
export interface AppGates {}

/** An ability name defined by one of the application's gates. */
export type GateName = keyof AppGates extends never ? string : keyof AppGates & string

/**
 * The abilities `BasePolicy` resolves. A policy may add its own methods, which
 * is why `Ability` below stays open.
 */
export type PolicyAbility = 'viewAny' | 'view' | 'create' | 'update' | 'delete' | 'restore' | 'forceDelete'

/**
 * Any ability that can be checked.
 *
 * Deliberately open. An ability is legitimately dynamic - a `/can/:ability`
 * route passes one straight through, which is the reason
 * `RESERVED_POLICY_MEMBERS` exists at all - so narrowing this to the declared
 * set would reject correct code and break the fail-closed tests that check
 * what an UNKNOWN ability does. The union is here for the editor: the gates
 * and policy abilities are offered, and anything else still compiles.
 */
// eslint-disable-next-line ts/ban-types -- `string & {}` keeps literal completions alive
export type Ability = GateName | PolicyAbility | (string & {})

/**
 * Augmentation target: the policy classes under `app/Policies/`, and the
 * framework defaults behind it, by filename.
 */
// eslint-disable-next-line ts/no-empty-object-type -- augmentation target; empty by design
export interface PolicyClasses {}

/** A policy class name, as narrow as the application has made it. */
export type PolicyName = keyof PolicyClasses extends never ? string : keyof PolicyClasses & string

/**
 * Augmentation target: the models a policy may be registered for.
 *
 * Derived from the models barrel, so it is the models that exist rather than a
 * list somebody maintains alongside them.
 */
// eslint-disable-next-line ts/no-empty-object-type -- augmentation target; empty by design
export interface PolicyModels {}

/** A model name a policy may be registered for. */
export type PolicyModelName = keyof PolicyModels extends never ? string : keyof PolicyModels & string

/** Runs before every check. `true` allows, `false` denies, `null` continues. */
export type GateBeforeCallback = (_user: UserModel | null, _ability: string, _args: unknown[]) => boolean | null | Promise<boolean | null>

/** Runs after every check. A boolean overrides the result; anything else keeps it. */
export type GateAfterCallback = (_user: UserModel | null, _ability: string, _result: boolean, _args: unknown[]) => boolean | void | Promise<boolean | void>

/**
 * How `app/Gates.ts` maps a model to the policy that authorizes it.
 *
 * Every key optional: a mapping is written only for the models whose policy
 * does not follow the `<Model>Policy` convention.
 */
export type PolicyMapping = {
  readonly [K in PolicyModelName]?: PolicyName | { policy: PolicyName, model?: PolicyModelName }
}

/** The shape of `app/Gates.ts`. */
export interface GatesDefinition {
  /** Ability name to the check that answers it. */
  gates: Readonly<Record<string, GateCallback>>
  /** Model name to the policy class that authorizes it. */
  policies?: PolicyMapping
  /** Callbacks that run before every check. */
  before?: readonly GateBeforeCallback[]
  /** Callbacks that run after every check. */
  after?: readonly GateAfterCallback[]
}

/**
 * Every key of a policy map that is not a model, required to hold something no
 * policy name can be.
 *
 * Applied to the PARAMETER rather than to the type parameter's constraint: a
 * constraint that reads `T['policies']` is a self-reference and TypeScript
 * refuses it, while the parameter may name `T` freely because inference has
 * already run against the `T &` half.
 */
type OnlyKnownModels<TPolicies> = {
  [K in keyof TPolicies]: K extends PolicyModelName
    ? TPolicies[K]
    : { 'this is not a model in this application': never }
}

/**
 * Define the application's gates, policy mappings and before/after callbacks.
 *
 * The `define*` helper for `app/Gates.ts`. Both halves of `policies` are
 * checked - the key names a model that exists, the value names a policy file
 * that exists - where the type used to be
 * `Record<string, string | { policy: string }>` on both sides, so a mapping to
 * a policy that is not there registered nothing and denied every check on that
 * model with no error anywhere.
 *
 * The `const` type parameter keeps the ability names, which is what
 * `storage/framework/types/gates.d.ts` reads back to fill `AppGates`.
 *
 * The second half of the constraint is what rejects a key that is not a model,
 * and it is not redundant with `PolicyMapping`. Excess-property checking is a
 * freshness rule on the object literal and stops applying as soon as inference
 * has a matching property to work with: `{ Psot: 'PostPolicy' }` alone was
 * caught, and the same typo beside one correct entry was not. Requiring every
 * key outside the model list to hold something no policy name can be makes the
 * check structural.
 *
 * @example
 * ```ts
 * // app/Gates.ts
 * import { defineGates } from '@stacksjs/auth'
 *
 * export default defineGates({
 *   gates: {
 *     'access-admin': user => user?.email?.endsWith('@stacksjs.org') ?? false,
 *   },
 *   policies: {
 *     Post: 'PostPolicy',
 *   },
 * })
 * ```
 */
export function defineGates<const T extends GatesDefinition>(
  definition: T & { policies?: OnlyKnownModels<T['policies']> },
): T {
  return definition
}

/**
 * Policy method type. The return type intentionally allows `null` so that
 * a policy's `before()` hook (which returns `null` to delegate to the
 * underlying ability check) is index-compatible with the catch-all
 * `[key: string]: PolicyMethod | undefined` signature on `Policy`.
 */
export type PolicyMethod<T = any> = (_user: UserModel | null, _model?: T, ..._args: any[]) => boolean | null | Promise<boolean | null> | AuthorizationResponse

/**
 * Method names that live on `BasePolicy.prototype` (or `Object`) and must
 * NEVER be resolvable as an ability. Without this guard, `policyInstance[ability]`
 * (unrestricted bracket access) would resolve inherited helpers like `allow`
 * / `allowIf` / `before` when the ability string is caller-influenced (e.g. a
 * generic `/can/:ability` route), and calling `allow()` returns an
 * unconditional ALLOW — a fail-open authorization bypass. See the auth
 * correctness sweep (stacksjs/stacks#1985).
 */
const RESERVED_POLICY_MEMBERS: ReadonlySet<string> = new Set([
  'before',
  'allow',
  'deny',
  'denyIf',
  'denyUnless',
  'allowIf',
  'constructor',
])

/**
 * Authorization response for detailed allow/deny
 */
export class AuthorizationResponse {
  public readonly isAllowed: boolean
  public readonly message?: string
  public readonly code?: string

  constructor(
    allowed: boolean,
    message?: string,
    code?: string,
  ) {
    this.isAllowed = allowed
    this.message = message
    this.code = code
  }

  static allow(message?: string): AuthorizationResponse {
    return new AuthorizationResponse(true, message)
  }

  static deny(message?: string, code?: string): AuthorizationResponse {
    return new AuthorizationResponse(false, message || 'This action is unauthorized.', code)
  }

  allowed(): boolean {
    return this.isAllowed
  }

  denied(): boolean {
    return !this.isAllowed
  }

  authorize(): void {
    if (!this.isAllowed) {
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
  beforeCallbacks: GateBeforeCallback[]
  afterCallbacks: GateAfterCallback[]
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
export function policy(model: PolicyModelName | { name: PolicyModelName }, policyClass: new () => Policy): void {
  const modelName = typeof model === 'string' ? model : model.name
  state.policies.set(modelName, policyClass)
}

/**
 * Register a callback to run before all gate checks
 *
 * @example
 * before((user, _ability) => {
 *   if (user?.isSuperAdmin) return true // Super admins can do anything
 *   return null // Continue to normal checks
 * })
 */
export function before(callback: GateBeforeCallback): void {
  state.beforeCallbacks.push(callback)
}

/**
 * Register a callback to run after all gate checks
 */
export function after(callback: GateAfterCallback): void {
  state.afterCallbacks.push(callback)
}

/**
 * Check if the user is allowed to perform an ability
 *
 * @example
 * if (await allows('edit-settings', user)) { ... }
 * if (await allows('update', user, post)) { ... }
 */
export async function allows(ability: Ability, user: UserModel | null, ...args: any[]): Promise<boolean> {
  return check(ability, user, ...args)
}

/**
 * Check if the user is denied from performing an ability
 *
 * @example
 * if (await denies('delete', user, post)) { ... }
 */
export async function denies(ability: Ability, user: UserModel | null, ...args: any[]): Promise<boolean> {
  return !(await check(ability, user, ...args))
}

/**
 * Check if the user can perform an ability (alias for allows)
 */
export async function can(ability: Ability, user: UserModel | null, ...args: any[]): Promise<boolean> {
  return check(ability, user, ...args)
}

/**
 * Check if the user cannot perform an ability (alias for denies)
 */
export async function cannot(ability: Ability, user: UserModel | null, ...args: any[]): Promise<boolean> {
  return !(await check(ability, user, ...args))
}

/**
 * Check if the user can perform any of the given abilities
 *
 * @example
 * if (await any(['update', 'delete'], user, post)) { ... }
 */
export async function any(abilities: readonly Ability[], user: UserModel | null, ...args: any[]): Promise<boolean> {
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
export async function all(abilities: readonly Ability[], user: UserModel | null, ...args: any[]): Promise<boolean> {
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
export async function none(abilities: readonly Ability[], user: UserModel | null, ...args: any[]): Promise<boolean> {
  return !(await any(abilities, user, ...args))
}

/**
 * Authorize an ability or throw an exception
 *
 * @example
 * await authorize('update', user, post) // Throws if not allowed
 */
export async function authorize(ability: Ability, user: UserModel | null, ...args: any[]): Promise<AuthorizationResponse> {
  const result = await inspect(ability, user, ...args)

  if (!result.isAllowed) {
    throw new AuthorizationException(result.message, result.code)
  }

  return result
}

/**
 * Get detailed inspection result for an ability check
 */
export async function inspect(ability: Ability, user: UserModel | null, ...args: any[]): Promise<AuthorizationResponse> {
  let response: AuthorizationResponse | null = null

  // Run before callbacks. An explicit true/false is an override that
  // short-circuits policy/gate resolution — but it still passes through the
  // after callbacks below (Laravel parity).
  for (const callback of state.beforeCallbacks) {
    const beforeResult = await callback(user, ability, args)
    if (beforeResult === true) {
      response = AuthorizationResponse.allow()
      break
    }
    if (beforeResult === false) {
      response = AuthorizationResponse.deny()
      break
    }
    // null means continue checking
  }

  if (!response)
    response = await resolveAbility(ability, user, args)

  // Run after callbacks for EVERY resolution path — policy, inline gate, and
  // the default deny — not just inline gates as before. A global
  // `Gate.after()` override / lockdown kill-switch was previously bypassed
  // for any policy-resolved ability (the common case for model
  // authorization: view/update/delete). stacksjs/stacks#1985.
  for (const callback of state.afterCallbacks) {
    const afterResult = await callback(user, ability, response.isAllowed, args)
    if (typeof afterResult === 'boolean') {
      return afterResult ? AuthorizationResponse.allow() : AuthorizationResponse.deny()
    }
  }

  return response
}

/**
 * Resolve an ability through the policy -> inline-gate -> default-deny chain,
 * WITHOUT running the before/after callbacks. `inspect()` owns those so they
 * apply uniformly to every path.
 */
async function resolveAbility(ability: string, user: UserModel | null, args: any[]): Promise<AuthorizationResponse> {
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

      // Resolve the ability to a policy method, but never to an inherited
      // BasePolicy/Object helper (see RESERVED_POLICY_MEMBERS) — that path
      // is a fail-open bypass when the ability string is caller-influenced.
      // Require an own function too, so only real ability methods run.
      const method = RESERVED_POLICY_MEMBERS.has(ability)
        ? undefined
        : policyInstance[ability] as PolicyMethod | undefined
      if (typeof method === 'function') {
        const result = await method.call(policyInstance, user, ...args)
        // null is treated as "no opinion" — fall through to deny here since
        // we already exhausted the policy resolution path for this ability.
        return normalizeResponse(result ?? false)
      }
    }
  }

  // Check inline gate
  const gate = state.gates.get(ability)
  if (gate) {
    return normalizeResponse(await gate(user, ...args))
  }

  // No gate or policy found - deny by default
  return AuthorizationResponse.deny(`No gate or policy defined for ability: ${ability}`)
}

/**
 * Core check implementation
 */
async function check(ability: string, user: UserModel | null, ...args: any[]): Promise<boolean> {
  const response = await inspect(ability, user, ...args)
  return response.isAllowed
}

/**
 * Normalize a gate/policy result to AuthorizationResponse.
 *
 * Strictly accepts only boolean or AuthorizationResponse. The previous
 * `result ? allow() : deny()` form interpreted ANY truthy value as
 * "allow" — a policy that accidentally returned `await User.find(id)`
 * (a user object) would be treated as authorization granted, even
 * though the policy author meant "fetched the user as a side effect,
 * not deciding on permission". Failing loudly catches the bug.
 */
function normalizeResponse(result: boolean | AuthorizationResponse): AuthorizationResponse {
  if (result instanceof AuthorizationResponse) {
    return result
  }
  if (typeof result !== 'boolean') {
    throw new TypeError(
      `[gate] Policy must return boolean or AuthorizationResponse; got ${typeof result}. `
      + 'If you returned a model/value by mistake, return `true`/`false` instead.',
    )
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
export function has(ability: Ability): boolean {
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
