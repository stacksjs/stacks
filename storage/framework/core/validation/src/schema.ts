import type { ValidationInstance, Validator } from '@stacksjs/ts-validation'
import { v } from '@stacksjs/ts-validation'
import { file, FileValidator } from './file-validator'
import { withConditionals } from './conditional'
import { objectWithContext } from './object-with-context'
import type { ConditionalAPI } from './conditional'
import type { ObjectWithContextValidator } from './object-with-context'

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
export type SchemaWithFile = Omit<ValidationInstance, 'object'> & {
  file: () => FileValidator
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

/**
 * Wrap a ts-validation factory function so each returned validator
 * gets `.when()` / `.sometimes()` (see ./conditional.ts) added.
 */
function wrapFactory<F extends (...args: any[]) => Validator<any>>(factory: F): F {
  return ((...args: Parameters<F>) => {
    const validator = factory(...args)
    return withConditionals(validator)
  }) as unknown as F
}

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
    if (typeof prop === 'string' && FACTORY_KEYS.has(prop)) {
      const factory = Reflect.get(target, prop, receiver)
      if (typeof factory === 'function') return wrapFactory(factory)
    }
    return Reflect.get(target, prop, receiver)
  },
})

export { file, FileValidator } from './file-validator'
export type { FileLike } from './file-validator'
export { applyConditionals, shouldApplyConditional, withConditionals } from './conditional'
export type { ConditionalAPI, ConditionalRecord, ValidatorWithConditionals } from './conditional'
export { objectWithContext } from './object-with-context'
export type { ObjectWithContextValidator } from './object-with-context'
