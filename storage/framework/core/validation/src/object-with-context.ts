/**
 * Object validator with cross-field context — backs the Stacks
 * `schema.object(...)` so `.when()` clauses (see ./conditional.ts) can
 * evaluate against sibling fields during validation
 * (stacksjs/stacks#1890).
 *
 * `ts-validation`'s `ObjectValidator.validate(value)` walks the shape
 * and calls each child's `.validate(childValue)` with only the child's
 * own value — there's no parent context. That's fine when every rule
 * is field-local, but breaks the moment a field needs to see another
 * field's value. This wrapper preserves the original shape semantics
 * (same error map shape, same nested-error key joining, same per-field
 * dispatch) and only adds the conditional refinement before each
 * child's `.validate()` call.
 *
 * For non-conditional schemas the wrapper is functionally identical to
 * the upstream validator — the conditional walk is a no-op when no
 * field has `__conditionals` set, so existing apps see no behavior
 * change.
 */

import type { ValidationResult, Validator } from '@stacksjs/ts-validation'
import { applyConditionals, withConditionals } from './conditional'
import type { ConditionalAPI } from './conditional'

/**
 * Validator-shaped object returned by `schema.object()`. Mirrors the
 * subset of ts-validation's `ObjectValidatorType` that Stacks code
 * actually uses today (`validate`, `shape`, `optional`, `required`).
 *
 * Extra method:
 *   - `getShape()` — exposes the underlying shape map so OpenAPI export
 *     and other introspection passes can walk the per-field validators
 *     (and their `__conditionals` arrays).
 */
export interface ObjectWithContextValidator<T extends Record<string, Validator<any>>> extends Validator<Record<string, unknown>> {
  readonly name: 'object'
  /**
   * Run validation against `value`. Conditionals on child validators
   * are evaluated against `value` itself, then each refined child runs
   * its own `.validate()`. Errors are aggregated by field name (matching
   * the ts-validation `ValidationErrorMap` shape).
   */
  validate: (value: unknown) => ValidationResult
  /** Surface the shape map for introspection. */
  getShape: () => T
  /** Mark the whole object as required (mirrors ts-validation). */
  required: () => this
  /** Mark the whole object as optional (mirrors ts-validation). */
  optional: () => this
  /** Internal flag set when nested inside another object's shape. */
  isPartOfShape: boolean
  /** Replace or extend the shape after construction. */
  shape: (shape: T) => ObjectWithContextValidator<T>
}

/**
 * Build a Stacks-flavored object validator that respects conditional
 * rules on its child validators. Drop-in for `v.object(...)` in
 * `@stacksjs/ts-validation` — same call shape, broader behavior.
 *
 * @example
 * ```ts
 * objectWithContext({
 *   payment_method: schema.enum(['card', 'bank']),
 *   card_token:     schema.string().when('payment_method', 'card', s => s.required()),
 *   bank_account:   schema.string().when('payment_method', 'bank', s => s.required()),
 *   username:       schema.string().sometimes().minLength(3),
 * }).validate(input)
 * ```
 */
export function objectWithContext<T extends Record<string, Validator<any>>>(
  initialShape?: T,
): ObjectWithContextValidator<T> & ConditionalAPI<ObjectWithContextValidator<T>> {
  let shape: T = (initialShape ?? {}) as T
  let isRequired = true

  const validator: ObjectWithContextValidator<T> = {
    name: 'object',
    get isRequired() {
      return isRequired
    },
    getRules: () => [],
    test(value: Record<string, unknown>) {
      return this.validate(value).valid
    },
    // Public + settable: a parent shape-walker (or legacy ObjectValidator
    // wrapper) can flip this via `validator.isPartOfShape = true` to opt
    // into the error-map error shape. `validate()` reads via `this.` so
    // external mutations are observed correctly.
    isPartOfShape: false,

    shape(next: T) {
      shape = next
      return validator as ObjectWithContextValidator<T>
    },

    getShape() {
      return shape
    },

    required() {
      isRequired = true
      return augmented
    },

    optional() {
      isRequired = false
      return augmented
    },

    validate(value: unknown): ValidationResult {
      // Top-level required-check matches BaseValidator semantics so
      // `objectWithContext().required().validate(undefined)` still fails
      // with the standard "required" error rather than silently passing.
      const isEmpty = value === undefined || value === null
      if (!isRequired && isEmpty) {
        return { valid: true, errors: this.isPartOfShape ? {} : [] }
      }
      if (isRequired && isEmpty) {
        const message = 'value is required'
        return this.isPartOfShape
          ? { valid: false, errors: { object: [{ message }] } }
          : { valid: false, errors: [{ message }] }
      }
      if (typeof value !== 'object' || Array.isArray(value)) {
        const message = 'Must be an object'
        return this.isPartOfShape
          ? { valid: false, errors: { object: [{ message }] } }
          : { valid: false, errors: [{ message }] }
      }

      const parent = value as Record<string, unknown>
      const errors: Record<string, { message: string }[]> = {}
      let hasErrors = false

      for (const key of Object.keys(shape)) {
        const baseChild = shape[key]
        if (!baseChild) continue

        // Apply conditional refinement against the parent context. If
        // no conditionals fire, the base validator is returned as-is.
        const child = applyConditionals(baseChild, parent)
        const fieldValue = parent[key]
        const result = child.validate(fieldValue)
        if (result.valid) continue

        hasErrors = true
        const isMap = !Array.isArray(result.errors)
        if (isMap) {
          // Nested ObjectValidator-shaped errors — flatten with the
          // standard `parent.child` key convention used by the upstream
          // ObjectValidator for parity.
          for (const [nestedKey, nestedErrors] of Object.entries(result.errors)) {
            errors[`${key}.${nestedKey}`] = nestedErrors as { message: string }[]
          }
        }
        else {
          errors[key] = result.errors as { message: string }[]
        }
      }

      if (hasErrors) return { valid: false, errors }
      return { valid: true, errors: {} }
    },
  }

  // Wire `.when()` / `.sometimes()` onto the object validator itself so
  // nested-object-level conditionals work too (e.g. an entire object
  // sub-tree is required only when a sibling key matches a value).
  type ObjectChain = ObjectWithContextValidator<T> & ConditionalAPI<ObjectWithContextValidator<T>>
  const augmented = withConditionals(validator as unknown as Validator<any>) as unknown as ObjectChain

  return augmented
}
