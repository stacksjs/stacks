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

    for (const key of Object.keys(obj)) {
      // `JSON.parse` keeps a `"__proto__"` key as an ordinary own key, and
      // assigning it ran the `__proto__` setter: `merge({}, body)` on
      // `{"__proto__":{"isAdmin":true}}` came back with `isAdmin` true,
      // inherited. defu, which this replaces, skips the key too.
      if (key === '__proto__') continue

      const value = obj[key]
      const existing = Object.hasOwn(result, key) ? result[key] : undefined

      if (value === undefined) continue

      if (Array.isArray(value)) {
        result[key] = Array.isArray(existing) ? [...existing, ...value] : [...value]
      }
      else if (isPlainObject(value)) {
        result[key] = merge(isPlainObject(existing) ? existing : {}, value)
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
 * Only plain records participate in recursive merging
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  if (prototype === null || prototype === Object.prototype) return true
  // A foreign realm has its own Object.prototype. A null-derived class also
  // ends at null, so check the prototype's own constructor without invoking getters.
  if (Object.getPrototypeOf(prototype) !== null) return false
  const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value
  return typeof constructor === 'function'
    && Function.prototype.toString.call(constructor) === Function.prototype.toString.call(Object)
}

// Aliases for defu compatibility
export const defu = mergeDefaults
export const defuArrayFn = merge
export { merge as default }
