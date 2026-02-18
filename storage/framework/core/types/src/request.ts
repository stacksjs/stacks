
type UserJsonResponse = ModelRow<typeof User>
import type { UploadedFile } from '@stacksjs/storage'
import type { AuthToken, RouteParam } from '@stacksjs/types'

interface RequestData {
  [key: string]: any
}

type RouteParams = { [key: string]: string | number } | null

type NumericField = 'id' | 'age' | 'count' | 'quantity' | 'amount' | 'price' | 'total' | 'score' | 'rating' | 'duration' | 'size' | 'weight' | 'height' | 'width' | 'length' | 'distance' | 'speed' | 'temperature' | 'volume' | 'capacity' | 'density' | 'pressure' | 'force' | 'energy' | 'power' | 'frequency' | 'voltage' | 'current' | 'resistance' | 'time' | 'date' | 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond' | 'microsecond' | 'nanosecond'

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
export interface RequestInstance<TFields extends Record<string, any> = Record<string, any>> {
  // ==========================================================================
  // Native Request properties
  // ==========================================================================

  url: string
  method: string
  headers: Headers

  // Raw data access (always untyped — use get()/input() for typed access)
  query: RequestData
  params: RouteParams
  jsonBody?: any
  formBody?: any
  files: Record<string, File | File[]>

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
  // Route & Param Methods — not narrowed to model fields
  // ==========================================================================

  getParam: <K extends string>(key: K) => K extends NumericField ? number : string
  route: (key: string) => number | string | null
  getParams: () => RouteParams
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
