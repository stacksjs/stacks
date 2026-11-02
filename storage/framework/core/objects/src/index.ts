import type { DeepMerge } from '@stacksjs/types'
import { notNullish } from '@stacksjs/utils'
import { isObject } from '@stacksjs/validation'

export * from './transform'

/**
 * Map key/value pairs for an object, and construct a new one
 *
 *
 * @category Object
 *
 * Transform:
 * @example
 * ```
 * objectMap({ a: 1, b: 2 }, (k, v) => [k.toString().toUpperCase(), v.toString()])
 * // { A: '1', B: '2' }
 * ```
 *
 * Swap key/value:
 * @example
 * ```
 * objectMap({ a: 1, b: 2 }, (k, v) => [v, k])
 * // { 1: 'a', 2: 'b' }
 * ```
 *
 * Filter keys:
 * @example
 * ```
 * objectMap({ a: 1, b: 2 }, (k, v) => k === 'a' ? undefined : [k, v])
 * // { b: 2 }
 * ```
 */
export function objectMap<K extends string, V, NK extends PropertyKey = K, NV = V>(
  obj: Record<K, V>,
  fn: (key: K, value: V) => [NK, NV] | undefined,
): Record<NK, NV> {
  return Object.fromEntries(
    Object.entries(obj)
      .map(([k, v]) => fn(k as K, v as V))
      .filter(notNullish),
  ) as Record<NK, NV>
}

/**
 * Type guard for any key, `k`.
 * Marks `k` as a key of `T` if `k` is in `obj`.
 *
 * @category Object
 * @param obj object to query for key `k`
 * @param k key to check existence in `obj`
 */
export function isKeyOf<T extends object>(obj: T, k: keyof any): k is keyof T {
  return k in obj
}

/**
 * Strict typed `Object.keys`
 *
 * @category Object
 */
export function objectKeys<T extends object>(obj: T) {
  return Object.keys(obj) as Array<`${keyof T & (string | number | boolean | null | undefined)}`>
}

/**
 * Strict typed `Object.entries`
 *
 * @category Object
 */
export function objectEntries<T extends object>(obj: T) {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>
}

/**
 * Deep merge :P
 *
 * A `"__proto__"` key in a source is skipped. `JSON.parse`, and the router's
 * request input, keep one as an ordinary own key, and following it walked into
 * `Object.prototype`: `deepMerge({}, JSON.parse('{"__proto__":{"isAdmin":true}}'))`
 * made `isAdmin` true on every object in the process. Only the target's own
 * properties are merged into, so an inherited one is never followed either.
 *
 * @category Object
 */
export function deepMerge<T extends object = object, S extends object = T>(
  target: T,
  ...sources: S[]
): DeepMerge<T, S> {
  if (!sources.length)
    return target as DeepMerge<T, S>

  const [source, ...remaining] = sources
  if (source === undefined)
    return target as DeepMerge<T, S>

  if (isMergeableObject(target) && isMergeableObject(source)) {
    const into = target as Record<string, unknown>
    const from = source as Record<string, unknown>

    for (const key of Object.keys(from)) {
      if (key === '__proto__')
        continue

      if (isMergeableObject(from[key])) {
        if (!Object.hasOwn(into, key) || !into[key])
          into[key] = {}

        deepMerge(into[key] as object, from[key] as object)
      }
      else {
        into[key] = from[key]
      }
    }
  }

  return deepMerge(target, ...remaining)
}

function isMergeableObject(item: any): item is object {
  return isObject(item) && !Array.isArray(item)
}

/**
 * Create a new subset object by providing keys.
 *
 * @category Object
 */
export function objectPick<O extends object, T extends keyof O>(obj: O, keys: T[], omitUndefined = false): Pick<O, T> {
  return keys.reduce(
    (n, k) => {
      if (k in obj) {
        if (!omitUndefined || obj[k] !== undefined)
          n[k] = obj[k]
      }
      return n
    },
    {} as Pick<O, T>,
  )
}

/**
 * Clear undefined fields from an object. It mutates the object.
 *
 * @category Object
 */
export function clearUndefined<T extends object>(obj: T): T {
  ;(Object.keys(obj) as Array<keyof T>).forEach(key => obj[key] === undefined && delete obj[key])
  return obj
}

/**
 * Determines whether an object has a property with the specified name
 *
 * @category Object
 */
export function hasOwnProperty<T>(obj: T, v: PropertyKey): boolean {
  return obj == null ? false : Object.prototype.hasOwnProperty.call(obj, v)
}
