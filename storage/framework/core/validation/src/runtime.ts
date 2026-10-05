/**
 * Schema-declaration entrypoint.
 *
 * The package root also carries `./validator`, which is where the weight is:
 * it reaches `@stacksjs/path`, `@stacksjs/strings`, `@stacksjs/utils` and
 * `@stacksjs/error-handling` to validate an incoming request. Measured in
 * fresh processes, `./schema` costs ~16 ms and `./validator` ~149 ms.
 *
 * Almost nothing needs the second one. Of the framework's 263 files importing
 * this package, 254 import exactly `{ schema }` - every model declaring
 * `validation: { rule: schema.string() }` - and the server's global injection
 * took `schema` alone too. Two files use `validate`, and they keep the root.
 *
 * Export order is load-bearing, for the same reason it is in the barrel: bind
 * `schema` before the `@stacksjs/ts-validation` star re-export, so a consumer
 * arriving mid-evaluation through the auto-imports graph sees the Proxy rather
 * than ts-validation's own `schema` symbol.
 */
export { schema } from './schema'

// Conditional validation surface (stacksjs/stacks#1890).
export {
  applyConditionals,
  objectWithContext,
  shouldApplyConditional,
  withConditionals,
} from './schema'

export type {
  ConditionalAPI,
  ConditionalRecord,
  InferObjectShape,
  InferredArrayValidator,
  InferredEnumValidator,
  InferValidatorValue,
  ObjectWithContextValidator,
  ValidatorShape,
  ValidatorWithConditionals,
} from './schema'

export * from '@stacksjs/ts-validation'
