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
): Partial<Record<NK, NV>> {
  return Object.fromEntries(
    Object.entries(obj)
      .map(([k, v]) => fn(k as K, v as V))
      .filter(notNullish),
  ) as Partial<Record<NK, NV>>
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
export type ObjectStringKey<T extends object> = `${Extract<keyof T, string | number>}`
export type ObjectStringEntry<T extends object> = [ObjectStringKey<T>, T[Extract<keyof T, string | number>]]

export function objectKeys<T extends object>(obj: T): Array<ObjectStringKey<T>> {
  return Object.keys(obj) as Array<ObjectStringKey<T>>
}

/**
 * Strict typed `Object.entries`
 *
 * @category Object
 */
export function objectEntries<T extends object>(obj: T): Array<ObjectStringEntry<T>> {
  return Object.entries(obj) as Array<ObjectStringEntry<T>>
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
 * Only plain objects are merged key by key. A Date, Map, Set or class instance
 * in a source is a value and is assigned; it used to be merged into a fresh
 * `{}` and arrive empty. A string, array or number in the target gives way to
 * a source's object; one that was truthy used to stay.
 *
 * @category Object
 */
export function deepMerge<T extends object = object, S extends object = T>(
  target: T,
  ...sources: S[]
): DeepMerge<T, S> {
  for (const source of sources) {
    if (isMergeableObject(target) && isMergeableObject(source))
      mergeGraph(target as Record<string, unknown>, source as Record<string, unknown>, new WeakMap())
  }
  return target as DeepMerge<T, S>
}

/** A source node maps to its first destination within each source overlay. */
function mergeGraph(into: Record<string, unknown>, from: Record<string, unknown>, seen: WeakMap<object, object>): void {
  seen.set(from, into)
  for (const key of Object.keys(from)) {
    if (key === '__proto__') continue
    const value = from[key]
    let merged = value
    if (isPlainObject(value)) {
      const mapped = seen.get(value)
      if (mapped) merged = mapped
      else {
        const existing = Object.hasOwn(into, key) ? into[key] : undefined
        const child = isPlainObject(existing) ? existing : {}
        mergeGraph(child, value, seen)
        merged = child
      }
    }
    if (Object.hasOwn(into, key)) into[key] = merged
    else Object.defineProperty(into, key, { value: merged, writable: true, enumerable: true, configurable: true })
  }
}

function isMergeableObject(item: any): item is object {
  return isObject(item) && !Array.isArray(item)
}

/** An object literal, a null-prototype object or parsed JSON: an object made of its keys. */
function isPlainObject(item: unknown): item is Record<string, unknown> {
  if (typeof item !== 'object' || item === null)
    return false
  const proto = Object.getPrototypeOf(item)
  if (proto === null || proto === Object.prototype) return true
  if (Object.getPrototypeOf(proto) !== null) return false
  const constructor = Object.getOwnPropertyDescriptor(proto, 'constructor')?.value
  return typeof constructor === 'function'
    && Function.prototype.toString.call(constructor) === Function.prototype.toString.call(Object)
}

/**
 * Create a new subset object by providing keys.
 *
 * @category Object
 */
export function objectPick<O extends object, T extends keyof O>(obj: O, keys: T[], omitUndefined = false): Pick<O, T> {
  return Object.fromEntries(
    keys.filter(key => key in obj && (!omitUndefined || obj[key] !== undefined)).map(key => [key, obj[key]]),
  ) as Pick<O, T>
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
