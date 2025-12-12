// Re-export everything from @stacksjs/ts-validation
export * from '@stacksjs/ts-validation'

// Export local validation helpers
export * from './reporter'
export * from './schema'
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
