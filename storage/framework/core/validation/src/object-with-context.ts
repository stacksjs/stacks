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
 * Successful results also expose the declared, supplied fields as `value`,
 * allowing request boundaries to discard undeclared nested input without
 * running any validator again.
 */

import type { RequiredMarker, ValidationResult, Validator } from '@stacksjs/ts-validation'
import { rememberValidatedValue } from './validated-value'
import { validationFailure, validateRule } from './messages'
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
export type ValidatorShape = Readonly<Record<string, Validator<any>>>

/** Resolve the value accepted by one validator. */
export type InferValidatorValue<TValidator> = TValidator extends Validator<infer TValue> ? TValue : never

/** Resolve an object value directly from its validator shape. */
export type InferObjectShape<TShape extends ValidatorShape> = {
  -readonly [TKey in keyof TShape]: InferValidatorValue<TShape[TKey]>
}

export interface ObjectWithContextValidator<TShape extends ValidatorShape> extends Validator<InferObjectShape<TShape>> {
  readonly name: 'object'
  /**
   * Run validation against `value`. Conditionals on child validators
   * are evaluated against `value` itself, then each refined child runs
   * its own `.validate()`. Errors are aggregated by field name (matching
   * the ts-validation `ValidationErrorMap` shape).
   */
  validate: (value: InferObjectShape<TShape>) => ValidationResult
  /** Surface the shape map for introspection. */
  getShape: () => TShape
  /**
   * Mark the whole object as required (mirrors ts-validation).
   *
   * The `RequiredMarker` is what makes required-ness readable at the type
   * level - `IsRequired<typeof rule>` - so a shape inferred from a rule set
   * knows which keys are optional. Mirroring the interface without it would
   * make this validator the one that always reads as optional.
   */
  required: () => this & RequiredMarker
  /** Mark the whole object as optional (mirrors ts-validation). */
  optional: () => this
  /** Internal flag set when nested inside another object's shape. */
  isPartOfShape: boolean
  /** Replace or extend the shape after construction. */
  shape: <TNextShape extends ValidatorShape>(shape: TNextShape) => ObjectWithContextValidator<TNextShape>
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
export function objectWithContext<const TShape extends ValidatorShape = Record<string, never>>(
  initialShape?: TShape,
): ObjectWithContextValidator<TShape> & ConditionalAPI<ObjectWithContextValidator<TShape>> {
  type ObjectState = ObjectWithContextValidator<TShape> & { schema: ValidatorShape }
  const validator: ObjectState = {
    name: 'object',
    // `isRequired` and `schema` live on the instance, as ts-validation's own
    // validators keep them, and are set through `this` below. A `.when()`
    // refinement runs on a copy of this object (see `cloneValidator` in
    // ./conditional.ts), and state held in this function's scope was shared by
    // that copy: the refinement changed the schema itself, for every later
    // input.
    isRequired: true,
    schema: initialShape ?? {},
    getRules: () => [],
    test(value: InferObjectShape<TShape>) {
      return this.validate(value).valid
    },
    // Public + settable: a parent shape-walker (or legacy ObjectValidator
    // wrapper) can flip this via `validator.isPartOfShape = true` to opt
    // into the error-map error shape. `validate()` reads via `this.` so
    // external mutations are observed correctly.
    isPartOfShape: false,

    shape<TNextShape extends ValidatorShape>(next: TNextShape) {
      this.schema = next
      return this as unknown as ObjectWithContextValidator<TNextShape>
    },

    getShape() {
      return this.schema as TShape
    },

    required() {
      this.isRequired = true
      // The marker is phantom - nothing is added here. The cast IS the marker,
      // in the one place it can be, exactly as ts-validation's base does it.
      return this as unknown as ObjectChain & RequiredMarker
    },

    optional() {
      this.isRequired = false
      return this as unknown as ObjectChain
    },

    validate(value: unknown): ValidationResult {
      // Top-level required-check matches BaseValidator semantics so
      // `objectWithContext().required().validate(undefined)` still fails
      // with the standard "required" error rather than silently passing.
      const isEmpty = value === undefined || value === null
      if (!this.isRequired && isEmpty) {
        return { valid: true, errors: this.isPartOfShape ? {} : [] }
      }
      if (this.isRequired && isEmpty) {
        const error = validationFailure('value is required', 'required')
        return this.isPartOfShape
          ? { valid: false, errors: { object: [error] } }
          : { valid: false, errors: [error] }
      }
      if (typeof value !== 'object' || Array.isArray(value)) {
        const message = 'Must be an object'
        return this.isPartOfShape
          ? { valid: false, errors: { object: [{ message }] } }
          : { valid: false, errors: [{ message }] }
      }

      const parent = value as Record<string, unknown>
      const errors: Record<string, { message: string }[]> = Object.create(null)
      const cleaned: Array<[string, unknown]> = []
      let hasErrors = false

      for (const key of Object.keys(this.schema)) {
        const baseChild = this.schema[key]
        if (!baseChild) continue

        // Apply conditional refinement against the parent context. If
        // no conditionals fire, the base validator is returned as-is.
        const child = applyConditionals(baseChild, parent)
        const fieldValue = Object.hasOwn(parent, key) ? parent[key] : undefined
        const result = validateRule(child, fieldValue)
        if (result.valid) {
          if (Object.hasOwn(parent, key)) cleaned.push([key, 'value' in result ? result.value : fieldValue])
          continue
        }

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
      const projected = Object.fromEntries(cleaned)
      rememberValidatedValue(this, parent, projected)
      return { valid: true, errors: {}, value: projected } as ValidationResult
    },
  }

  // Wire `.when()` / `.sometimes()` onto the object validator itself so
  // nested-object-level conditionals work too (e.g. an entire object
  // sub-tree is required only when a sibling key matches a value).
  type ObjectChain = ObjectState & ConditionalAPI<ObjectWithContextValidator<TShape>>
  const augmented = withConditionals(validator as unknown as Validator<any>) as unknown as ObjectChain

  return augmented
}
