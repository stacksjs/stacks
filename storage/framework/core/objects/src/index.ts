import type { DeepMerge } from '@stacksjs/types'
import { notNullish } from '@stacksjs/utils'
import { isObject } from '@stacksjs/validation'

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
export function objectMap<K extends string, V, NK = K, NV = V>(
  obj: Record<K, V>,
  fn: (key: K, value: V) => [NK, NV] | undefined,
): Record<K, V> {
  return Object.fromEntries(
    Object.entries(obj)
      .map(([k, v]) => fn(k as K, v as V))
      .filter(notNullish),
  )
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
 * @category Object
 */
export function deepMerge<T extends object = object, S extends object = T>(
  target: T,
  ...sources: S[]
): DeepMerge<T, S> {
  if (!sources.length)
    return target as any

  const source = sources.shift()
  if (source === undefined)
    return target as any

  if (isMergeableObject(target) && isMergeableObject(source)) {
    objectKeys(source).forEach((key) => {
      // @ts-expect-error some description
      if (isMergeableObject(source[key])) {
        // @ts-expect-error some description
        if (!target[key])
          // @ts-expect-error some description
          target[key] = {}

        // @ts-expect-error some description
        deepMerge(target[key], source[key])
      }
      else {
        // @ts-expect-error some description
        target[key] = source[key]
      }
    })
  }

  return deepMerge(target, ...sources)
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
