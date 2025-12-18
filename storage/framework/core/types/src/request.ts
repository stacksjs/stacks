import type { UserModelType } from '@stacksjs/orm'
import type { AuthToken, RouteParam } from '@stacksjs/types'

export type * from '../../../types/requests'

interface RequestData {
  [key: string]: any
}

type RouteParams = { [key: string]: string | number } | null

interface ValidationRule {
  validate: (value: unknown) => { valid: boolean, errors?: Array<{ message: string }> }
}

interface ValidationField {
  rule: ValidationRule
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}

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
export interface SafeData<T extends Record<string, unknown> = Record<string, unknown>> {
  only: <K extends keyof T>(keys: K[]) => Pick<T, K>
  except: <K extends keyof T>(keys: K[]) => Omit<T, K>
  merge: <U extends Record<string, unknown>>(data: U) => T & U
  all: () => T
  has: (key: keyof T) => boolean
  get: <K extends keyof T>(key: K) => T[K]
}

/**
 * RequestInstance - Enhanced request interface with Laravel-style methods
 *
 * This interface extends the native Request with additional helper methods
 * for input handling, validation, and data manipulation.
 */
export interface RequestInstance {
  // Native Request properties
  url: string
  method: string
  headers: Headers

  // Query, body, params
  query: RequestData
  params: RouteParams
  jsonBody?: any
  formBody?: any
  files: Record<string, File | File[]>

  // ==========================================================================
  // Laravel-style Input Methods
  // ==========================================================================

  /**
   * Get input value from any source (query, body, params) - Laravel style
   * @example request.get('name')
   * @example request.get('name', 'default')
   */
  get: <T = string>(key: string, defaultValue?: T) => T

  /**
   * Alias for get() - Laravel compatibility
   */
  input: <T = any>(key: string, defaultValue?: T) => T

  /**
   * Get all input data
   */
  all: () => RequestData

  /**
   * Get only specified keys
   * @example request.only(['name', 'email'])
   */
  only: <T extends Record<string, unknown> = Record<string, unknown>>(keys: string[]) => T

  /**
   * Get all except specified keys
   * @example request.except(['password', 'token'])
   */
  except: <T extends Record<string, unknown> = Record<string, unknown>>(keys: string[]) => T

  /**
   * Check if input has a key (or all keys if array)
   * @example request.has('name')
   * @example request.has(['name', 'email'])
   */
  has: (key: string | string[]) => boolean

  /**
   * Check if input has any of the keys
   * @example request.hasAny(['name', 'email'])
   */
  hasAny: (keys: string[]) => boolean

  /**
   * Check if input is filled (not empty)
   * @example request.filled('name')
   */
  filled: (key: string | string[]) => boolean

  /**
   * Check if input is missing
   * @example request.missing('name')
   */
  missing: (key: string | string[]) => boolean

  /**
   * Merge additional data into input
   */
  merge: (data: Record<string, unknown>) => void

  // ==========================================================================
  // Type-casting Methods
  // ==========================================================================

  /**
   * Get string input
   * @example request.string('name')
   */
  string: (key: string, defaultValue?: string) => string

  /**
   * Get integer input
   * @example request.integer('page', 1)
   */
  integer: (key: string, defaultValue?: number) => number

  /**
   * Get float input
   * @example request.float('price', 0.0)
   */
  float: (key: string, defaultValue?: number) => number

  /**
   * Get boolean input
   * @example request.boolean('active', false)
   */
  boolean: (key: string, defaultValue?: boolean) => boolean

  /**
   * Get input as array
   * @example request.array('tags')
   */
  array: <T = unknown>(key: string) => T[]

  /**
   * Parse date input
   * @example request.date('birthday')
   */
  date: (key: string, format?: string) => Date | null

  /**
   * Parse enum input
   * @example request.enum('status', StatusEnum)
   */
  enum: <T extends Record<string, string | number>>(key: string, enumType: T) => T[keyof T] | null

  /**
   * Get input as collection
   * @example request.collect('items')
   */
  collect: <T = unknown>(key: string) => Collection<T>

  /**
   * Get all input keys
   */
  keys: () => string[]

  // ==========================================================================
  // Validation Methods
  // ==========================================================================

  /**
   * Validate the request data
   * @example await request.validate({ name: 'required|string', email: 'required|email' })
   */
  validate: <T extends Record<string, unknown> = Record<string, unknown>>(
    rules: Record<string, string>,
    messages?: Record<string, string>,
  ) => Promise<T>

  /**
   * Get validated data as typed object
   */
  getValidated: <T extends Record<string, unknown> = Record<string, unknown>>() => T

  /**
   * Get safe validated data wrapper
   */
  safe: <T extends Record<string, unknown> = Record<string, unknown>>() => SafeData<T>

  // ==========================================================================
  // Conditional Methods
  // ==========================================================================

  /**
   * Execute callback when input has a value
   * @example request.whenHas('name', (value) => console.log(value))
   */
  whenHas: <T>(key: string, callback: (value: T) => void, defaultCallback?: () => void) => void

  /**
   * Execute callback when input is filled
   * @example request.whenFilled('name', (value) => console.log(value))
   */
  whenFilled: <T>(key: string, callback: (value: T) => void, defaultCallback?: () => void) => void

  /**
   * Check if input matches a value
   */
  isValue: (key: string, value: unknown) => boolean

  // ==========================================================================
  // File Methods
  // ==========================================================================

  file: (key: string) => File | null
  getFiles: (key: string) => File[]
  hasFile: (key: string) => boolean
  allFiles: () => Record<string, File | File[]>

  // ==========================================================================
  // Header Methods
  // ==========================================================================

  header: (key: string) => string | null
  bearerToken: () => string | null | AuthToken

  // ==========================================================================
  // Route & Param Methods
  // ==========================================================================

  getParam: <K extends string>(key: K) => K extends NumericField ? number : string
  route: (key: string) => number | string | null
  getParams: () => RouteParams
  getParamAsInt: (key: string) => number | null

  // ==========================================================================
  // Session/Flash Methods
  // ==========================================================================

  /**
   * Get old input (for form repopulation)
   */
  old: <T = unknown>(key: string, defaultValue?: T) => T

  /**
   * Flash input to session for form repopulation
   */
  flashInput: (keys?: string[]) => void

  /**
   * Flash only specific keys
   */
  flashInputOnly: (keys: string[]) => void

  /**
   * Flash except specific keys
   */
  flashInputExcept: (keys: string[]) => void

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  json: <T = any>() => Promise<T>
  isEmpty: () => boolean
  browser: () => string | null
  ip: () => string | null
  ipForRateLimit: () => string | null
  getMethod: () => HttpMethod
  user: () => Promise<UserModelType | undefined>
}
