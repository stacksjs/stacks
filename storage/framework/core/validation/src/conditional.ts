/**
 * Conditional validation rules — `.when()` and `.sometimes()`
 * (stacksjs/stacks#1890, F-4 from #1874).
 *
 * `ts-validation` doesn't model cross-field conditions, so apps used to
 * work around with custom `refine()` callbacks at the cost of generic
 * error messages and an opaque schema (OpenAPI / form-renderer readers
 * couldn't see the real shape).
 *
 * This module layers two surfaces on top:
 *
 *   - `.when(field, valueOrPredicate, refineFn)` — apply additional
 *     rules only when another field on the parent object matches a
 *     value (literal) or predicate. Stores the conditional structurally
 *     on `validator.__conditionals` so downstream readers (OpenAPI
 *     export, form rendering) can introspect rather than seeing a
 *     collapsed shape.
 *
 *   - `.sometimes()` — Laravel-style "run rules only when the key is
 *     present on the input". Maps to ts-validation's existing
 *     `.optional()` semantics (skip rules when value is
 *     `undefined`/`null`/`''`) but reads more naturally for the
 *     "present-only" intent.
 *
 * The runtime is intentionally minimal — it doesn't fork ts-validation.
 * Instead, the conditionals are evaluated by {@link objectWithContext}
 * (see ./object-with-context.ts) during shape validation, which is the
 * only place we have a parent object to compare against.
 */

import type { Validator } from '@stacksjs/ts-validation'

/**
 * A single `.when()` clause attached to a field validator. Multiple
 * `.when()` calls stack — they're evaluated in registration order and
 * each matching one further refines the base validator.
 */
export interface ConditionalRecord<V extends Validator<any>> {
  /** Name of the sibling field on the parent object to inspect. */
  field: string
  /**
   * Literal value to match or predicate function. Literal is compared
   * with strict equality; predicate receives the sibling value and
   * returns `true` to apply the refinement.
   */
  match: unknown | ((value: unknown) => boolean)
  /**
   * Refinement function — receives the base validator and returns a
   * (possibly new) validator with additional rules layered on. The
   * common case is to call `.required()` / `.minLength()` / etc. on
   * the input and return it.
   */
  refine: (validator: V) => V
}

/** Anything that has a mutable conditionals array — duck-typed so this
 *  works across all the ts-validation validator subclasses. */
export interface ValidatorWithConditionals<V extends Validator<any>> {
  /** Conditional clauses recorded by `.when()`. Public so OpenAPI
   *  exporters / form renderers can introspect the real shape. */
  __conditionals?: ConditionalRecord<V>[]
}

/**
 * Conditional-rules surface — apps reach these methods through
 * `.when()` / `.sometimes()` on any validator the schema proxy returns.
 */
export interface ConditionalAPI<V extends Validator<any>> {
  /**
   * Attach a `when` clause: the refinement only fires for inputs where
   * the named sibling field matches `match`.
   *
   * @example
   * ```ts
   * schema.object({
   *   payment_method: schema.enum(['card', 'bank']),
   *   card_token:     schema.string().when('payment_method', 'card', s => s.required()),
   *   bank_account:   schema.string().when('payment_method', 'bank', s => s.required()),
   * })
   * ```
   */
  when: (
    field: string,
    match: unknown | ((value: unknown) => boolean),
    refine: (validator: V) => V,
  ) => V & ConditionalAPI<V>
  /**
   * Mark a field as "only validate when present on the input." Equivalent
   * to `.optional()` semantics in ts-validation (skip rules when value is
   * `undefined` / `null` / `''`), exposed under the Laravel-style name
   * for clarity at the call site.
   *
   * @example
   * ```ts
   * schema.object({
   *   // skip the minLength check when the user omits `username` entirely
   *   username: schema.string().sometimes().minLength(3),
   * })
   * ```
   */
  sometimes: () => V & ConditionalAPI<V>
}

/**
 * Mixin: add `.when()` / `.sometimes()` to a validator instance.
 *
 * Mutates the validator in place (assigning the new methods) so the
 * existing chainable surface (`.required()`, `.minLength()`, etc.)
 * keeps returning `this`. Returns the same instance with the augmented
 * type so callers see the new methods on the fluent chain.
 */
export function withConditionals<V extends Validator<any>>(validator: V): V & ConditionalAPI<V> {
  const augmented = validator as V & ConditionalAPI<V> & ValidatorWithConditionals<V>

  augmented.when = function when(field, match, refine) {
    if (!this.__conditionals) this.__conditionals = []
    this.__conditionals.push({ field, match, refine })
    return this
  }

  augmented.sometimes = function sometimes() {
    // `.optional()` returns `this` per the ts-validation contract;
    // re-export under the Laravel-flavored name.
    this.optional()
    return this
  }

  return augmented
}

/**
 * Evaluate a single `when` clause against a parent object.
 *
 * Returns `true` when the conditional should fire (and its refinement
 * should be applied). Pure function — no side effects, safe to call
 * during introspection too.
 */
export function shouldApplyConditional(
  record: ConditionalRecord<Validator<any>>,
  parent: Record<string, unknown> | null | undefined,
): boolean {
  if (parent === null || parent === undefined) return false
  const siblingValue = parent[record.field]
  if (typeof record.match === 'function') {
    return (record.match as (value: unknown) => boolean)(siblingValue)
  }
  return siblingValue === record.match
}

/**
 * Apply every matching conditional on `base` against `parent`, in
 * registration order. Returns the (possibly refined) validator that
 * should be used to validate the field.
 *
 * The base validator is NEVER mutated — ts-validation methods like
 * `.required()` and `.min(3)` MUTATE `this` and return it, so calling
 * refine functions directly on the base would leak across `validate()`
 * invocations (each call would compound the previous refinements,
 * making "VAT required for EU customers" sticky across requests).
 * {@link cloneValidator} produces an isolated instance the refine
 * pipeline can safely mutate without polluting the schema definition.
 */
export function applyConditionals<V extends Validator<any>>(
  base: V,
  parent: Record<string, unknown> | null | undefined,
): V {
  const records = (base as V & ValidatorWithConditionals<V>).__conditionals
  if (!records || records.length === 0) return base

  // Materialize a working copy only when at least one conditional
  // actually fires — non-matching predicates pay zero clone cost.
  let working: V | null = null
  for (const record of records) {
    if (!shouldApplyConditional(record as unknown as ConditionalRecord<Validator<any>>, parent)) continue
    if (working === null) working = cloneValidator(base)
    working = record.refine(working)
  }
  return working ?? base
}

/**
 * Shallow-clone a validator instance with its own `rules` array so
 * `addRule()`-style mutations on the clone don't leak into the base.
 *
 * We deliberately keep the prototype chain intact (so `.email()`,
 * `.min()`, etc. resolve via the original class methods) and only
 * re-create the slot that gets mutated by ts-validation's chainable
 * methods. `isRequired` is a plain boolean and `Object.assign` already
 * copies it across.
 */
function cloneValidator<V>(v: V): V {
  const clone = Object.create(Object.getPrototypeOf(v))
  Object.assign(clone, v)
  const rules = (v as unknown as { rules?: unknown[] }).rules
  if (Array.isArray(rules)) (clone as unknown as { rules: unknown[] }).rules = rules.slice()
  return clone as V
}
