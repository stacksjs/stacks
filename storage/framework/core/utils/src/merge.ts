/**
 * Deep merge objects (defu replacement)
 *
 * Merges multiple objects together, with later objects taking precedence.
 * Arrays are concatenated, objects are recursively merged.
 */

type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T

export function merge<T extends Record<string, any>>(...objects: DeepPartial<T>[]): T {
  // Assembled as a plain record and named as `T` once, at the return.
  //
  // The shape is built key by key out of partials, so no individual assignment
  // below can be checked against `T` - each used to carry its own cast, which
  // meant the merged array and recursive-merge branches were unchecked against
  // each other as well as against the result.
  const result: Record<string, unknown> = {}

  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') continue

    for (const key in obj) {
      const value = obj[key]
      const existing = result[key]

      if (value === undefined) continue

      if (Array.isArray(value)) {
        result[key] = Array.isArray(existing) ? [...existing, ...value] : [...value]
      }
      else if (value && typeof value === 'object' && !isSpecialObject(value)) {
        result[key] = merge(existing || {}, value)
      }
      else {
        result[key] = value
      }
    }
  }

  return result as T
}

/**
 * Create a merger function with defaults (defu-like API)
 */
export function createMerger<T extends Record<string, any>>(defaults: T) {
  return (...objects: DeepPartial<T>[]): T => {
    return merge<T>(defaults as DeepPartial<T>, ...objects)
  }
}

/**
 * Merge with defaults (defu API)
 */
export function mergeDefaults<T extends Record<string, any>>(
  obj: DeepPartial<T>,
  ...defaults: DeepPartial<T>[]
): T {
  return merge<T>({} as DeepPartial<T>, ...defaults, obj)
}

/**
 * Check if object is a special type that shouldn't be merged
 */
function isSpecialObject(obj: any): boolean {
  if (obj instanceof Date) return true
  if (obj instanceof RegExp) return true
  if (obj instanceof Error) return true
  if (obj instanceof Promise) return true
  if (obj instanceof Map) return true
  if (obj instanceof Set) return true
  if (obj instanceof WeakMap) return true
  if (obj instanceof WeakSet) return true
  if (ArrayBuffer.isView(obj)) return true
  return false
}

// Aliases for defu compatibility
export const defu = mergeDefaults
export const defuArrayFn = merge
export { merge as default }
