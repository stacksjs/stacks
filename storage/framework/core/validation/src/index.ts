// Order matters: bind `schema` first so any consumer that imports it
// transitively — validator.ts → schema, plus any user model that lands
// inside the auto-imports barrel — sees the Proxy rather than an empty
// namespace placeholder. With this export below the others, ESM consumers
// arriving mid-evaluation through the auto-imports graph would race the
// `export *` re-exports from `@stacksjs/ts-validation` (which also exports
// a `schema` symbol) and see whichever binding was registered first.
export { schema } from './schema'

// Re-export everything from @stacksjs/ts-validation. The explicit `schema`
// export above shadows ts-validation's own `schema` for `import { schema }
// from '@stacksjs/validation'` consumers — which is what we want, since the
// Proxy keeps `schema.<method>()` reactive across module-graph races.
export * from '@stacksjs/ts-validation'

// Export local validation helpers
export * from './reporter'
export * from './validator'

// Type guard utilities
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value)
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

export function isFunction(value: unknown): value is Function {
  return typeof value === 'function'
}

export function isUndefined(value: unknown): value is undefined {
  return value === undefined
}

export function isNull(value: unknown): value is null {
  return value === null
}

export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined
}
