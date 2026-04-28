import { getTypeName } from '@stacksjs/types'

/**
 * Deep equality with NaN-safety and cycle detection.
 *
 * - `NaN === NaN` is false in JavaScript, so the previous `Object.is`
 *   tail correctly handled that case but only at the leaf — a
 *   `[NaN, NaN]` pair compared element-by-element worked, but compound
 *   structures relied on the tail. The new shape preserves that.
 * - Circular references used to send isDeepEqual into infinite recursion
 *   (`a.self = a; isDeepEqual(a, a)` blew the stack). A WeakSet of
 *   already-visited objects breaks the cycle and treats two structurally
 *   identical cycles as equal.
 */
export function isDeepEqual(value1: any, value2: any, seen: WeakMap<object, object> = new WeakMap()): boolean {
  if (value1 === value2) return true
  if (typeof value1 === 'number' && typeof value2 === 'number' && Number.isNaN(value1) && Number.isNaN(value2)) return true

  const type1 = getTypeName(value1)
  const type2 = getTypeName(value2)
  if (type1 !== type2) return false

  // Cycle detection: if we've seen value1 before paired with value2,
  // assume they're equal (otherwise we'd recurse forever).
  if (value1 && typeof value1 === 'object') {
    const prior = seen.get(value1 as object)
    if (prior === value2) return true
    seen.set(value1 as object, value2 as object)
  }

  if (type1 === 'array') {
    if (value1.length !== value2.length) return false
    return value1.every((item: any, i: number) => isDeepEqual(item, value2[i], seen))
  }

  if (type1 === 'object') {
    const keyArr = Object.keys(value1)
    if (keyArr.length !== Object.keys(value2).length) return false
    return keyArr.every((key: string) => isDeepEqual(value1[key], value2[key], seen))
  }

  return Object.is(value1, value2)
}
