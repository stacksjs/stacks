import type { ModelRow } from '@stacksjs/orm'
import { User } from '@stacksjs/orm'
import type { UploadedFile } from '@stacksjs/storage'
import type { AuthToken, RouteParam } from '@stacksjs/types'
// `Infer<T extends Validator<U>>` resolves to the validator's output
// type — `Infer<typeof schema.string()> → string`. Type-only import
// keeps this package free of a runtime ts-validation dependency.
import type { Infer } from '@stacksjs/ts-validation'

type UserJsonResponse = ModelRow<typeof User>

interface RequestData {
  [key: string]: any
}

/**
 * Loose route-param shape kept around for back-compat with code that
 * predates {@link RequestInstance}'s `TParams` generic. New code should
 * rely on the path-extracted `TParams` instead — see {@link ExtractParams}.
 *
 * @deprecated Use {@link ExtractParams}-driven typing on the action /
 *   route signature instead. URL route params are always strings at
 *   runtime; the `string | number` here misled callers into thinking
 *   the framework coerced numbers automatically (it doesn't —
 *   `Number(request.params.id)` is the correct pattern).
 */
type RouteParams = { [key: string]: string | number } | null

/**
 * Legacy hard-coded list of param names treated as `number` by
 * {@link RequestInstance.getParam}. The name-match heuristic is
 * brittle (`'judgeId'`, `'user_id'`, etc. all silently fall through
 * to `string`) and will be retired in a future release.
 *
 * @deprecated The name-match returns `number` for these specific keys
 *   only — pass the value through {@link Number} or
 *   {@link RequestInstance.getParamAsInt} for explicit, predictable
 *   coercion. See stacksjs/stacks#1851 Phase 3.
 */
type NumericField = 'id' | 'age' | 'count' | 'quantity' | 'amount' | 'price' | 'total' | 'score' | 'rating' | 'duration' | 'size' | 'weight' | 'height' | 'width' | 'length' | 'distance' | 'speed' | 'temperature' | 'volume' | 'capacity' | 'density' | 'pressure' | 'force' | 'energy' | 'power' | 'frequency' | 'voltage' | 'current' | 'resistance' | 'time' | 'date' | 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond' | 'microsecond' | 'nanosecond'

/**
 * Cookie-access helper exposed via `request.cookies` on
 * {@link RequestInstance}. The methods mirror bun-router's
 * `CookieAccessor` — duplicated locally so this package doesn't
 * have to depend on bun-router for a single type. Keep the surface
 * in sync if bun-router extends its accessor.
 */
export interface RequestCookies {
  get: (name: string) => string | undefined
  set: (name: string, value: string, options?: {
    path?: string
    domain?: string
    secure?: boolean
    httpOnly?: boolean
    sameSite?: 'strict' | 'lax' | 'none'
    maxAge?: number
    expires?: Date
  }) => void
  delete: (name: string, options?: { path?: string, domain?: string }) => void
  getAll: () => Record<string, string>
}

/**
 * Template-literal helper that extracts named route params from a
 * path string (stacksjs/stacks#1851 Phase 2a). Supports both Stacks's
 * brace-style (`/users/{id}`) and Express-style (`/users/:id`) so a
 * project using either gets typed `params` out of the box.
 *
 * @example
 *   ExtractParams<'/api/judges/{id}/follow'>  // { id: string }
 *   ExtractParams<'/api/orders/:orderId/items/:itemId'>  // { orderId: string, itemId: string }
 *   ExtractParams<'/api/health'>  // Record<string, never>
 */
// Step 1: pull the next param name out of either `{name}` or `:name`,
// recurse on the rest, and union the keys.
type ExtractParamKeys<S extends string> =
  // brace form: `…/{name}/…`
  S extends `${string}{${infer Key}}${infer Rest}`
    ? Key | ExtractParamKeys<Rest>
    // colon form: `…/:name/…` (colon must be at a segment boundary
    // so we don't match `:` inside e.g. a port number; the `/` before
    // it enforces that)
    : S extends `${string}/:${infer Key}/${infer Rest}`
      ? KeyHead<Key> | ExtractParamKeys<`/${Rest}`>
      // tail colon-form: `…/:name` (no trailing slash)
      : S extends `${string}/:${infer Key}`
        ? KeyHead<Key>
        : never

// `KeyHead<'name>'>` → `'name>'` because TS template literal infers
// the longest possible match. We need to handle params that are at
// the end of the path AND followed by a query string. This util
// truncates a captured key at the first non-name character.
type KeyHead<S extends string> =
  S extends `${infer H}/${string}` ? H :
    S extends `${infer H}?${string}` ? H :
      S extends `${infer H}.${string}` ? H :
        S

export type ExtractParams<S extends string> =
  [ExtractParamKeys<S>] extends [never]
    ? Record<string, never>
    : { [K in ExtractParamKeys<S>]: string }

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE'

/**
 * Collection interface for array data (Laravel-style)
 */
export interface Collection<T> {
  items: T[]
  count: () => number
  first: () => T | undefined
  last: () => T | undefined
  map: <U>(fn: (item: T, index: number) => U) => Collection<U>
  filter: (fn: (item: T, index: number) => boolean) => Collection<T>
  find: (fn: (item: T, index: number) => boolean) => T | undefined
  reduce: <U>(fn: (acc: U, item: T, index: number) => U, initial: U) => U
  forEach: (fn: (item: T, index: number) => void) => void
  toArray: () => T[]
  isEmpty: () => boolean
  isNotEmpty: () => boolean
  pluck: <K extends keyof T>(key: K) => Collection<T[K]>
  unique: () => Collection<T>
  sortBy: <K extends keyof T>(key: K, direction?: 'asc' | 'desc') => Collection<T>
  groupBy: <K extends keyof T>(key: K) => Map<T[K], Collection<T>>
  chunk: (size: number) => Collection<Collection<T>>
  take: (count: number) => Collection<T>
  skip: (count: number) => Collection<T>
  reverse: () => Collection<T>
  sum: (key?: keyof T) => number
  avg: (key?: keyof T) => number
  min: (key?: keyof T) => T | undefined
  max: (key?: keyof T) => T | undefined
}

/**
 * Safe validated data wrapper (Laravel-style)
 */
export interface SafeData<T extends Record<string, any> = Record<string, any>> {
  only: <K extends keyof T>(keys: K[]) => Pick<T, K>
  except: <K extends keyof T>(keys: K[]) => Omit<T, K>
  merge: <U extends Record<string, unknown>>(data: U) => T & U
  all: () => T
  has: (key: keyof T) => boolean
  get: <K extends keyof T>(key: K) => T[K]
}

/**
 * RequestInstance - Generic, model-aware request interface with Laravel-style methods.
 *
 * When used bare (`RequestInstance`), all methods accept any string keys (backward compatible).
 * When parameterized with model fields (`RequestInstance<{ title: string, views: number }>`),
 * all input methods narrow to those fields with full autocomplete and type inference.
 *
 * The global type alias connects this to models:
 *   `RequestInstance<typeof Post>` → narrows to Post's fields automatically.
 *
 * @example
 * // Untyped (accepts any key)
 * function handle(request: RequestInstance) {
 *   request.get('anything') // returns any
 * }
 *
 * @example
 * // Model-aware (narrows to Post's fields)
 * function handle(request: RequestInstance<typeof Post>) {
 *   request.get('title')   // autocompletes, returns string
 *   request.get('views')   // autocompletes, returns number
 *   request.get('invalid') // TS error!
 *   const data = await request.validate() // returns typed Post fields
 * }
 */
/**
 * Public alias for `RequestInstance<TFields>`. Use this in actions when
 * you want to type the `request` argument explicitly (e.g. without
 * pulling in a model object).
 *
 * @example
 * ```ts
 * import { Action } from '@stacksjs/actions'
 * import type { ActionRequest } from '@stacksjs/types'
 *
 * type CreatePostInput = { title: string; body: string }
 *
 * export default new Action({
 *   name: 'CreatePost',
 *   handle(request: ActionRequest<CreatePostInput>) {
 *     const { title, body } = request.only(['title', 'body'])
 *     // ^ inferred as { title: string; body: string }
 *   },
 * })
 * ```
 */
export type ActionRequest<
  TFields extends Record<string, any> = Record<string, any>,
  TParams extends Record<string, string> = Record<string, string>,
> = RequestInstance<TFields, TParams>

/**
 * Read the body shape declared by an action's `validations:` field as
 * a TypeScript object type (stacksjs/stacks#1851 Phase 2b). Threaded
 * into {@link RequestInstance}'s `TFields` so `request.all()` returns
 * the body shape with the field types {@link Infer}'d from each
 * `schema.X()` rule.
 *
 * @example
 *   const validations = {
 *     email:    { rule: schema.string().email() },
 *     password: { rule: schema.string().min(8) },
 *     remember: { rule: schema.boolean() },
 *   } as const
 *   type Body = InferValidations<typeof validations>
 *   // → { email: string, password: string, remember: boolean }
 */
export type InferValidations<V extends Record<string, { rule: any }>> = {
  [K in keyof V]: Infer<V[K]['rule']>
}

export interface RequestInstance<
  TFields extends Record<string, any> = Record<string, any>,
  TParams extends Record<string, string> = Record<string, string>,
> {
  // ==========================================================================
  // Native Request properties
  // ==========================================================================

  url: string
  method: string
  headers: Headers

  // Raw data access (always untyped — use get()/input() for typed access)
  query: RequestData
  /**
   * Route parameters from the URL. When the action is bound to a path
   * literal (via {@link ActionOptions.path} or a typed
   * `route.get<TPath>(...)` overload), `TParams` narrows to the
   * extracted keys so `request.params.id` is `string` with no `as any`.
   *
   * For un-narrowed callers (bare `RequestInstance`), this falls
   * back to `Record<string, string>` — the runtime shape is always
   * string-keyed even for "numeric" params, since URL segments are
   * never coerced.
   */
  params: TParams
  jsonBody?: any
  formBody?: any
  files: Record<string, File | File[]>
  /**
   * Cookies parsed from the request. The accessor exposes
   * `get`/`set`/`delete`/`getAll` helpers that mirror bun-router's
   * cookie handling. Optional because not every request middleware
   * stack runs the cookie parser.
   */
  cookies?: RequestCookies

  // ==========================================================================
  // Model-aware Input Methods
  //
  // Keys narrow to `keyof TFields` when a model type is provided.
  // Return types narrow to the field's actual type.
  // ==========================================================================

  /**
   * Get input value from any source (query, body, params)
   * @example request.get('title')           // returns string (when model-aware)
   * @example request.get('views', 0)        // returns number with default
   */
  get: <K extends keyof TFields & string>(key: K, defaultValue?: TFields[K]) => TFields[K]

  /**
   * Alias for get() - Laravel compatibility
   */
  input: <K extends keyof TFields & string>(key: K, defaultValue?: TFields[K]) => TFields[K]

  /**
   * Get all input data (typed to model fields when model-aware)
   */
  all: () => TFields

  /**
   * Get only specified keys — returns a precisely picked type
   * @example request.only(['title', 'views']) // { title: string, views: number }
   */
  only: <K extends keyof TFields & string>(keys: K[]) => Pick<TFields, K>

  /**
   * Get all except specified keys — returns a precisely omitted type
   * @example request.except(['id', 'created_at']) // omits those fields
   */
  except: <K extends keyof TFields & string>(keys: K[]) => Omit<TFields, K>

  /**
   * Check if input has a key (or all keys if array) — keys narrowed to model fields
   * @example request.has('title')
   * @example request.has(['title', 'views'])
   */
  has: (key: (keyof TFields & string) | (keyof TFields & string)[]) => boolean

  /**
   * Check if input has any of the specified keys
   * @example request.hasAny(['title', 'views'])
   */
  hasAny: (keys: (keyof TFields & string)[]) => boolean

  /**
   * Check if input is filled (present and not empty)
   * @example request.filled('title')
   */
  filled: (key: (keyof TFields & string) | (keyof TFields & string)[]) => boolean

  /**
   * Check if input is missing
   * @example request.missing('title')
   */
  missing: (key: (keyof TFields & string) | (keyof TFields & string)[]) => boolean

  /**
   * Merge additional data into input — accepts partial model fields
   */
  merge: (data: Partial<TFields>) => void

  /**
   * Get all input keys — returns model field names when model-aware
   */
  keys: () => (keyof TFields & string)[]

  // ==========================================================================
  // Type-casting Methods — keys narrowed to model fields
  // ==========================================================================

  /**
   * Get string input
   * @example request.string('title')
   */
  string: (key: keyof TFields & string, defaultValue?: string) => string

  /**
   * Get integer input
   * @example request.integer('views', 0)
   */
  integer: (key: keyof TFields & string, defaultValue?: number) => number

  /**
   * Get float input
   * @example request.float('price', 0.0)
   */
  float: (key: keyof TFields & string, defaultValue?: number) => number

  /**
   * Get boolean input
   * @example request.boolean('is_active', false)
   */
  boolean: (key: keyof TFields & string, defaultValue?: boolean) => boolean

  /**
   * Get input as array
   * @example request.array('tags')
   */
  array: <T = unknown>(key: keyof TFields & string) => T[]

  /**
   * Parse date input
   * @example request.date('published_at')
   */
  date: (key: keyof TFields & string, format?: string) => Date | null

  /**
   * Parse enum input
   * @example request.enum('status', StatusEnum)
   */
  enum: <T extends Record<string, string | number>>(key: keyof TFields & string, enumType: T) => T[keyof T] | null

  /**
   * Get input as collection
   * @example request.collect('items')
   */
  collect: <T = unknown>(key: keyof TFields & string) => Collection<T>

  // ==========================================================================
  // Validation Methods — returns typed model fields when model-aware
  // ==========================================================================

  /**
   * Validate the request data.
   * When model-aware, rules are optional (uses model's attribute validation).
   * Returns the validated data typed to model fields.
   *
   * @example await request.validate()                    // uses model rules
   * @example await request.validate({ name: 'required' }) // custom rules
   */
  validate: (rules?: Record<string, string>, messages?: Record<string, string>) => Promise<TFields>

  /**
   * Get previously validated data, typed to model fields
   */
  getValidated: () => TFields

  /**
   * Get safe validated data wrapper with typed access
   * @example request.safe().only(['title', 'views']) // Pick<TFields, 'title' | 'views'>
   * @example request.safe().get('title')              // string
   */
  safe: () => SafeData<TFields>

  // ==========================================================================
  // Conditional Methods — keys narrowed to model fields
  // ==========================================================================

  /**
   * Execute callback when input has a value
   * @example request.whenHas('title', (value) => console.log(value))
   */
  whenHas: <T>(key: keyof TFields & string, callback: (value: T) => void, defaultCallback?: () => void) => void

  /**
   * Execute callback when input is filled
   * @example request.whenFilled('title', (value) => console.log(value))
   */
  whenFilled: <T>(key: keyof TFields & string, callback: (value: T) => void, defaultCallback?: () => void) => void

  /**
   * Check if input matches a value
   */
  isValue: (key: keyof TFields & string, value: unknown) => boolean

  // ==========================================================================
  // File Methods — not narrowed to model fields (files are independent)
  // ==========================================================================

  /**
   * Get an uploaded file by key
   * @example const avatar = request.file('avatar')
   * @example await avatar?.store('avatars')
   */
  file: (key: string) => UploadedFile | null

  /**
   * Get all uploaded files for a key (for multiple file inputs)
   */
  getFiles: (key: string) => UploadedFile[]

  /**
   * Check if a file was uploaded
   */
  hasFile: (key: string) => boolean

  /**
   * Get all uploaded files
   */
  allFiles: () => Record<string, UploadedFile | UploadedFile[]>

  // ==========================================================================
  // Header Methods
  // ==========================================================================

  header: (key: string) => string | null
  bearerToken: () => string | null | AuthToken

  // ==========================================================================
  // Route & Param Methods
  //
  // `params` (the field above) is the typed primary surface — narrow
  // it via the action's `path:` literal for full inference. These
  // method-form helpers stay around for back-compat and for cases
  // where the param key isn't statically known.
  // ==========================================================================

  /**
   * Look up a single route param, optionally with a default. Narrows
   * to {@link TParams} when the key is part of the path-extracted
   * keyset; falls back to `string | undefined` otherwise (covers
   * dynamic key access without `as any`).
   *
   * @example
   *   const id = request.param('id')              // typed string (from path)
   *   const note = request.param('note', '')      // string with default
   */
  param: <K extends keyof TParams | string, D = string>(
    key: K,
    defaultValue?: D,
  ) => K extends keyof TParams ? TParams[K] : (string | D)
  /**
   * @deprecated Use {@link param} for typed param lookups, or
   *   `Number(request.params.id)` for explicit numeric coercion.
   *   The name-match heuristic returning `number` for {@link NumericField}
   *   keys (`id`, `count`, `amount`, …) is brittle: it silently falls
   *   through to `string` for `judgeId`, `user_id`, etc.
   *   See stacksjs/stacks#1851 Phase 3.
   */
  getParam: <K extends string>(key: K) => K extends NumericField ? number : string
  route: (key: string) => number | string | null
  getParams: () => TParams
  getParamAsInt: (key: string) => number | null

  // ==========================================================================
  // Session/Flash Methods — keys narrowed to model fields
  // ==========================================================================

  /**
   * Get old input (for form repopulation)
   */
  old: <T = unknown>(key: keyof TFields & string, defaultValue?: T) => T

  /**
   * Flash input to session for form repopulation
   */
  flashInput: (keys?: (keyof TFields & string)[]) => void

  /**
   * Flash only specific keys
   */
  flashInputOnly: (keys: (keyof TFields & string)[]) => void

  /**
   * Flash except specific keys
   */
  flashInputExcept: (keys: (keyof TFields & string)[]) => void

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  json: <T = any>() => Promise<T>
  isEmpty: () => boolean
  browser: () => string | null
  ip: () => string | null
  ipForRateLimit: () => string | null
  getMethod: () => HttpMethod
  user: () => Promise<UserJsonResponse | undefined>
}
