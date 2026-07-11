import type { ExtractParams, InferValidations, JobOptions, RequestInstance } from '@stacksjs/types'

/**
 * Shape of `validations:` on an action. Each entry pairs a
 * ts-validation `Validator<T>` rule with an optional error message.
 *
 * Kept loose at the index-signature level so existing actions with
 * untyped validation objects keep compiling. New code that wants the
 * body-inference benefit (stacksjs/stacks#1851 Phase 2b) declares
 * validations `as const` so {@link InferValidations} can read the
 * concrete rule types.
 *
 * Exported so the router can run validations without redeclaring the
 * type (stacksjs/stacks#1870 R-3 — the previous copy in
 * `stacks-router.ts` would drift out of sync).
 */
export interface ActionValidations {
  [key: string]: {
    rule: { validate: (value: any) => any }
    message?: string | Record<string, string>
  }
}

/**
 * Shape of {@link validateActionInput}'s return value. Lives here next
 * to {@link ActionValidations} so the router and actions package share
 * a single declaration (stacksjs/stacks#1870 R-3).
 */
export interface ValidationResult {
  valid: boolean
  errors: Record<string, string[]>
}

/**
 * Resolve the body shape (`TFields`) for an action's request:
 *
 *   1. If `model:` is a `defineModel()` return, use its row shape —
 *      preserves the existing model-aware ergonomics.
 *   2. Else if `validations:` is set as a const, infer the body
 *      from each rule's `Validator<T>` output type
 *      (stacksjs/stacks#1851 Phase 2b).
 *   3. Else fall back to `Record<string, any>` — bare-typed action
 *      with no narrowing.
 */
type ResolveBody<TModel, TValidations> =
  TModel extends { _isStacksModel: true }
    ? TModel
    : TValidations extends ActionValidations
      ? InferValidations<TValidations>
      : Record<string, any>

/**
 * Build the request type passed to the action's `handle()`. Combines
 * the body resolution above with path-extracted params from `TPath`
 * (stacksjs/stacks#1851 Phase 2a).
 */
type InferRequest<TModel, TValidations, TPath extends string> =
  TPath extends ''
    ? RequestInstance<ResolveBody<TModel, TValidations>>
    : RequestInstance<ResolveBody<TModel, TValidations>, ExtractParams<TPath>>

interface ActionOptions<
  TModel = string,
  TValidations extends ActionValidations | undefined = undefined,
  TPath extends string = '',
> {
  name?: string
  description?: string
  apiResponse?: boolean
  validations?: TValidations
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  rate?: JobOptions['rate']
  tries?: JobOptions['tries']
  backoff?: JobOptions['backoff']
  enabled?: JobOptions['enabled']
  /**
   * The literal route path this action serves. Declared as a string
   * literal (e.g. `path: '/api/judges/{id}/follow'`) so
   * {@link ExtractParams} can pull the param names out at compile
   * time and narrow `request.params`.
   *
   * Optional — actions registered via `route.get('/path', AnyAction)`
   * pick up the path from the call site, not the action itself.
   * Setting `path:` here is only needed when the action's own param
   * inference matters before registration (rare).
   */
  path?: TPath
  requestFile?: string
  model?: TModel
  /**
   * Opt this action out of the global CSRF gate.
   *
   * The router reads `action.skipCsrf === true || action.csrf === false`
   * (stacks-router.ts) when deciding whether to enforce the CSRF check
   * for a route this action serves. Previously the flag could only be
   * set via the chainable `route.post('/x', Action).skipCsrf()` form;
   * declaring it on the action's `ActionOptions` lets the action carry
   * its own security policy regardless of how it's registered.
   *
   * Use `skipCsrf` (intent-explicit) for new code. `csrf: false` is
   * accepted for symmetry with the group-config shape that
   * `route.group({ csrf: false }, …)` uses.
   *
   * See stacksjs/stacks#1870 R-1.
   */
  skipCsrf?: boolean
  /** @see {@link ActionOptions.skipCsrf} */
  csrf?: boolean
  /**
   * Optional pre-`handle()` authorization check. Runs after middleware
   * + validation but before {@link ActionOptions.before} and
   * {@link ActionOptions.handle}. Three legal returns:
   *
   *  - `true`     — proceed to `handle()`
   *  - `false`    — short-circuit with a `403 Forbidden` JSON response
   *  - `Response` — short-circuit with the caller's exact response
   *
   * Throwing an `HttpError` works too — it flows through the router's
   * normal error path.
   *
   * Use for resource-level checks ("can this user edit *this* post?")
   * that don't naturally fit into middleware (which can't see the
   * action's typed params). See stacksjs/stacks#1870 R-5.
   */
  authorize?: (
    request: InferRequest<TModel, TValidations, TPath>,
  ) => boolean | Response | Promise<boolean | Response>
  /**
   * Optional pre-`handle()` hook. Runs after `authorize` (if defined)
   * and before `handle()`. Returning a `Response` short-circuits the
   * action; returning `void` proceeds.
   *
   * Use for shared setup that's awkward in middleware: lazy-loading
   * a related model, recording analytics that depend on validated
   * input, etc. See stacksjs/stacks#1870 R-5.
   */
  before?: (
    request: InferRequest<TModel, TValidations, TPath>,
  ) => void | Response | Promise<void | Response>
  handle: {
    bivarianceHack: (
      request: InferRequest<TModel, TValidations, TPath>,
    ) => ActionResult | Promise<ActionResult>
  }['bivarianceHack']
  /**
   * Lightweight dependency factory (stacksjs/stacks#1870 R-6).
   * Returns the deps the action's `handle` / `before` / `authorize`
   * hooks read via `this.deps`. Resolved lazily on first access and
   * cached for the lifetime of the action instance.
   *
   * Tests swap individual deps via {@link Action.overrideDependencies}
   * without remounting the action or doing module-level mocking — the
   * pain point the issue called out (cross-cutting deps had to be
   * `import`-ed at module top, which the test runner couldn't
   * intercept short of full module replacement).
   *
   * @example
   * ```ts
   * export default new Action({
   *   name: 'CreateUser',
   *   dependencies: () => ({ db: useDb(), mailer: useMailer() }),
   *   async handle(req) {
   *     await this.deps.db.insertInto('users').values(req.body).execute()
   *     await this.deps.mailer.send({ to: req.body.email, subject: 'Welcome' })
   *   }
   * })
   *
   * // In test:
   * action.overrideDependencies({ db: mockDb, mailer: mockMailer })
   * await action.handle(mockReq)
   * action.resetDependencies()
   * ```
   */
  dependencies?: () => Record<string, unknown>
}

/**
 * Everything an action's `handle()` is allowed to return. The router's
 * `formatResult()` walks each branch:
 *
 *   - `Response`                       → returned as-is (caller built their own)
 *   - `null` / `undefined`             → `204` for API clients, empty `200` for browser
 *   - object / array (incl. records)   → `Response.json(...)`
 *   - `string` / `number` / `boolean`  → JSON-encoded for API clients, `text/plain`
 *                                        for top-level browser navigations
 *   - `ReadableStream`                 → streamed back (stacksjs/stacks#1870 R-4)
 *
 * Previously typed `Promise<any> | any`, which let non-serializable returns
 * (class instances with cycles, undefined-bearing tuples, etc.) sneak through
 * to runtime. Narrowing here surfaces them at the call site instead.
 * See stacksjs/stacks#1870 R-11.
 */
export type ActionResult =
  | Response
  | ReadableStream
  | null
  | undefined
  | string
  | number
  | boolean
  | object
  | unknown[]

export class Action<
  TModel = string,
  TValidations extends ActionValidations | undefined = undefined,
  TPath extends string = '',
> {
  name?: string
  description?: string
  apiResponse?: boolean
  rate?: ActionOptions['rate']
  tries?: ActionOptions['tries']
  backoff?: ActionOptions['backoff']
  enabled?: ActionOptions['enabled']
  path?: ActionOptions<TModel, TValidations, TPath>['path']
  method?: ActionOptions['method']
  validations?: TValidations
  requestFile?: string
  /** @see {@link ActionOptions.skipCsrf} */
  skipCsrf?: boolean
  /** @see {@link ActionOptions.skipCsrf} */
  csrf?: boolean
  /** @see {@link ActionOptions.authorize} */
  authorize?: ActionOptions<TModel, TValidations, TPath>['authorize']
  /** @see {@link ActionOptions.before} */
  before?: ActionOptions<TModel, TValidations, TPath>['before']
  handle: ActionOptions<TModel, TValidations, TPath>['handle']
  model?: string

  /**
   * Backing factory for {@link deps} (stacksjs/stacks#1870 R-6).
   * Held separately from the resolved value so {@link resetDependencies}
   * can re-run it on the next read.
   */
  private _dependenciesFactory?: () => Record<string, unknown>
  /** Cached factory result. Cleared by {@link resetDependencies}. */
  private _resolvedDeps?: Record<string, unknown>
  /**
   * Per-key overrides applied on top of the factory result. Tests
   * inject mocks here without disturbing the factory; runtime callers
   * never set this.
   */
  private _depsOverrides?: Record<string, unknown>

  constructor({
    name,
    description,
    apiResponse,
    validations,
    handle,
    rate,
    tries,
    backoff,
    enabled,
    path,
    method,
    requestFile,
    model,
    skipCsrf,
    csrf,
    authorize,
    before,
    dependencies,
  }: ActionOptions<TModel, TValidations, TPath>) {
    this.name = name
    this.description = description
    this.apiResponse = apiResponse
    this.validations = validations
    this.rate = rate
    this.tries = tries
    this.backoff = backoff
    this.enabled = enabled
    this.path = path
    this.method = method
    this.handle = handle
    this.requestFile = requestFile
    this.skipCsrf = skipCsrf
    this.csrf = csrf
    this.authorize = authorize
    this.before = before
    this._dependenciesFactory = dependencies

    // Extract model name string for runtime (route generation, etc.)
    if (model && typeof model === 'object' && 'name' in model) {
      this.model = (model as { name: string }).name
    }
    else if (typeof model === 'string') {
      this.model = model
    }
  }

  /**
   * Lazily-resolved dependency bag (stacksjs/stacks#1870 R-6). The
   * `dependencies:` factory passed to the constructor runs once on
   * first read; subsequent reads return the cached object merged with
   * any test-side {@link overrideDependencies} overlay.
   *
   * Empty `{}` when no factory was provided — accessing `this.deps`
   * is always safe even on legacy actions, so handle code can be
   * migrated incrementally.
   */
  get deps(): Record<string, unknown> {
    if (!this._resolvedDeps) {
      this._resolvedDeps = this._dependenciesFactory?.() ?? {}
    }
    if (this._depsOverrides) {
      return { ...this._resolvedDeps, ...this._depsOverrides }
    }
    return this._resolvedDeps
  }

  /**
   * Test-only: replace specific deps with mocks (stacksjs/stacks#1870 R-6).
   * Merges over the factory result so partial mocks are easy
   * (`overrideDependencies({ mailer: fakeMailer })` keeps the real
   * `db` from the factory). Call {@link resetDependencies} in
   * `afterEach` to restore.
   */
  overrideDependencies(overrides: Record<string, unknown>): void {
    this._depsOverrides = { ...(this._depsOverrides ?? {}), ...overrides }
  }

  /**
   * Test-only: clear the override overlay and force the factory to
   * re-run on next access. Pair with {@link overrideDependencies}
   * inside `beforeEach` / `afterEach`.
   */
  resetDependencies(): void {
    this._depsOverrides = undefined
    this._resolvedDeps = undefined
  }
}
