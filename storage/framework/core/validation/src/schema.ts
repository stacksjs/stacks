import type { ValidationInstance, Validator } from '@stacksjs/ts-validation'
import { v } from '@stacksjs/ts-validation'
import { rememberValidatedValue, validatedValue } from './validated-value'
import { file, FileValidator } from './file-validator'
import { withConditionals } from './conditional'
import { objectWithContext } from './object-with-context'
import type { ConditionalAPI } from './conditional'
import type { ObjectWithContextValidator } from './object-with-context'

export interface InferredEnumValidator<TValue extends string> extends Validator<TValue> {
  readonly name: 'enum'
  getAllowedValues: () => readonly TValue[]
  custom: (fn: (value: TValue) => boolean, message: string) => InferredEnumValidator<TValue>
}

export interface InferredArrayValidator<TValue> extends Validator<TValue[]> {
  readonly name: 'array'
  min: (length: number) => InferredArrayValidator<TValue>
  max: (length: number) => InferredArrayValidator<TValue>
  length: (length: number) => InferredArrayValidator<TValue>
  each: <TElement>(validator: Validator<TElement>) => InferredArrayValidator<TElement>
  unique: () => InferredArrayValidator<TValue>
}

type WithConditionals<TValidator extends Validator<any>> = TValidator & ConditionalAPI<TValidator>

type ConditionalValidationInstance = {
  // eslint-disable-next-line pickier/no-unused-vars
  [TKey in keyof ValidationInstance]: ValidationInstance[TKey] extends (...args: infer TArgs) => infer TValidator
    ? TValidator extends Validator<any>
      // eslint-disable-next-line pickier/no-unused-vars
      ? (...args: TArgs) => WithConditionals<TValidator>
      : ValidationInstance[TKey]
    : ValidationInstance[TKey]
}

/**
 * Extended `ValidationInstance` that adds `schema.file()` on top of the
 * ts-validation surface (stacksjs/stacks#1856). Upstream ts-validation
 * has `string()`, `number()`, `enum()`, etc. but no `file()` validator;
 * we layer one here without forking ts-validation so the rest of the
 * surface keeps working unchanged.
 *
 * The runtime value is the ts-validation proxy with `file` patched in,
 * `object` swapped for the context-aware variant (stacksjs/stacks#1890),
 * and every primitive factory wrapped to attach `.when()` / `.sometimes()`
 * to the returned validator.
 */
export type SchemaWithFile = Omit<ConditionalValidationInstance, 'array' | 'enum' | 'file' | 'object'> & {
  file: () => FileValidator
  array: <TValue = unknown>() => WithConditionals<InferredArrayValidator<TValue>>
  enum: <const TValues extends readonly string[]>(values: TValues) => WithConditionals<InferredEnumValidator<TValues[number]>>
  object: typeof objectWithContext
}

/**
 * Primitive factories on ts-validation's `v` return a chainable
 * `Validator<T>`. We intercept those calls so the returned validator
 * has `.when()` and `.sometimes()` mixed in — the cost is one
 * `withConditionals` call per `schema.string()` (etc.), and the
 * augmented validator keeps every original method (`.required()`,
 * `.minLength()`, ...) intact.
 *
 * The list is the field-level factories only — `object` has its own
 * override below (context-aware), and `file` is layered in by the
 * existing Stacks `file-validator` module.
 */
const FACTORY_KEYS = new Set([
  'array', 'bigint', 'binary', 'blob', 'boolean', 'custom', 'date',
  'datetime', 'decimal', 'double', 'enum', 'float', 'integer', 'json',
  'number', 'password', 'smallint', 'string', 'text', 'time',
  'timestamp', 'timestampTz', 'unix',
])

function isValidDateInput(value: unknown): boolean {
  if (value instanceof Date)
    return !Number.isNaN(value.getTime())

  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function dateInputFactory(): ReturnType<ValidationInstance['date']> {
  const validator = v.custom(isValidDateInput, 'Must be a valid date')
  validator.name = 'date'
  return withConditionals(validator) as unknown as ReturnType<ValidationInstance['date']>
}

/**
 * Anything the framework actually stores in a timestamp column.
 *
 * Upstream's `timestamp` accepts 32-bit epoch SECONDS and nothing else, so it
 * rejected every value the framework's own models produce: 39 attributes
 * across the default models validate with `schema.timestamp()`, and their
 * factories emit `toISOString()` or the `YYYY-MM-DD HH:MM:SS` form SQLite
 * returns. `Cart.expiresAt` failed its own factory's output, which is how this
 * surfaced: a storefront could not create a cart.
 *
 * Accepted: a Date, an ISO 8601 string, a SQL datetime string, and epoch
 * seconds or milliseconds as a number or a numeric string. Anything that does
 * not parse to a real instant is still rejected.
 */
function isValidTimestampInput(value: unknown): boolean {
  if (value instanceof Date)
    return !Number.isNaN(value.getTime())

  if (typeof value === 'number')
    return Number.isFinite(value) && value >= 0 && !Number.isNaN(new Date(value).getTime())

  if (typeof value !== 'string')
    return false

  const trimmed = value.trim()
  if (!trimmed)
    return false

  // Epoch as a string, seconds or milliseconds.
  if (/^\d+$/.test(trimmed))
    return isValidTimestampInput(Number(trimmed))

  // Validate the written calendar before parsing can normalize February 30.
  // SQL timestamps, minute precision, offsets and expanded ISO years remain supported.
  const parts = /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i.exec(trimmed)
  if (!parts) return false
  const calendar = new Date(`${parts[1]}-${parts[2]}-${parts[3]}T00:00:00.000Z`)
  if (!Number.isFinite(calendar.getTime()) || calendar.getUTCFullYear() !== Number(parts[1]) || calendar.getUTCMonth() + 1 !== Number(parts[2]) || calendar.getUTCDate() !== Number(parts[3])) return false
  if (parts[4] !== undefined) {
    const hour = Number(parts[4]), minute = Number(parts[5]), second = Number(parts[6] ?? 0)
    if (hour > 24 || minute > 59 || second > 59) return false
    if (hour === 24 && (minute !== 0 || second !== 0 || /[1-9]/.test(parts[7] ?? ''))) return false
  }
  return !Number.isNaN(new Date(trimmed.replace(' ', 'T')).getTime())
}

function timestampInputFactory(): ReturnType<ValidationInstance['timestamp']> {
  const validator = v.custom(isValidTimestampInput, 'Must be a valid timestamp')
  validator.name = 'timestamp'
  return withConditionals(validator) as unknown as ReturnType<ValidationInstance['timestamp']>
}

// Property access is much hotter than the number of factory names. Keep one
// forwarding function per name, then resolve the upstream factory when that
// function runs so extensions to ts-validation remain visible.
const elementRule = Symbol.for('stacks.validation.arrayElement')
function projectArray(validator: Validator<any>): Validator<any> {
  const array = validator as Validator<any> & { each: (rule: Validator<any>) => unknown, [elementRule]?: Validator<any> }
  const each = array.each
  const validate = array.validate
  array.each = function (rule) { this[elementRule] = rule; return each.call(this, rule) }
  array.validate = function (input) {
    const result = validate.call(this, input)
    const child = (this as typeof array)[elementRule]
    if (result.valid && child && Array.isArray(input)) {
      const value = input.map(item => validatedValue(child, item))
      rememberValidatedValue(this, input, value)
      return { ...result, value }
    }
    return result
  }
  return array
}

const wrappedFactories: Record<string, (...args: any[]) => Validator<any>> = Object.create(null)

/**
 * `Object.assign({}, v, { file })` would defeat the ts-validation
 * proxy's late-binding. Wrapping with `new Proxy` keeps every existing
 * `schema.<method>()` call going through the upstream proxy while only
 * intercepting the slots we own (`file`, `object`, and the conditional
 * mixin on primitive factories).
 */
export const schema: SchemaWithFile = new Proxy(v as unknown as SchemaWithFile, {
  get(target, prop, receiver) {
    if (prop === 'file') return file
    if (prop === 'object') return objectWithContext
    if (prop === 'date') return dateInputFactory
    if (prop === 'timestamp') return timestampInputFactory
    if (typeof prop === 'string') {
      const cached = wrappedFactories[prop]
      if (cached) return cached
      if (!FACTORY_KEYS.has(prop)) return Reflect.get(target, prop, receiver)
      const wrapped = (...args: any[]) => {
        const factory = Reflect.get(target, prop, receiver)
        const validator = factory(...args)
        return withConditionals(prop === 'array' ? projectArray(validator) : validator)
      }
      wrappedFactories[prop] = wrapped
      return wrapped
    }
    return Reflect.get(target, prop, receiver)
  },
})

export { file, FileValidator } from './file-validator'
export type { FileLike } from './file-validator'
export { applyConditionals, shouldApplyConditional, withConditionals } from './conditional'
export type { ConditionalAPI, ConditionalRecord, ValidatorWithConditionals } from './conditional'
export { objectWithContext } from './object-with-context'
export type { InferObjectShape, InferValidatorValue, ObjectWithContextValidator, ValidatorShape } from './object-with-context'
