/**
 * Deep merge objects (defu replacement)
 *
 * Merges multiple objects together, with later objects taking precedence.
 * Arrays are concatenated, objects are recursively merged.
 */

type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T

export function merge<T extends Record<string, any>>(...objects: DeepPartial<T>[]): T {
  const result = {} as T

  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') continue

    for (const key in obj) {
      const value = obj[key]
      const existing = result[key]

      if (value === undefined) continue

      if (Array.isArray(value)) {
        result[key] = (Array.isArray(existing) ? [...existing, ...value] : [...value]) as any
      }
      else if (value && typeof value === 'object' && !isSpecialObject(value)) {
        result[key] = merge(existing || {}, value) as any
      }
      else {
        result[key] = value as any
      }
    }
  }

  return result
}

/**
 * Create a merger function with defaults (defu-like API)
 */
export function createMerger<T extends Record<string, any>>(defaults: T) {
  return (...objects: DeepPartial<T>[]): T => {
    return merge(defaults, ...objects)
  }
}

/**
 * Merge with defaults (defu API)
 */
export function mergeDefaults<T extends Record<string, any>>(
  obj: DeepPartial<T>,
  ...defaults: DeepPartial<T>[]
): T {
  return merge({} as T, ...defaults, obj)
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
