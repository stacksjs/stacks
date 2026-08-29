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
export function isDeepEqual(value1: unknown, value2: unknown, seen: WeakMap<object, object> = new WeakMap()): boolean {
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

  // Narrowed with `Array.isArray` rather than by comparing `getTypeName`'s
  // answer to a string: the comparison decides the same thing at runtime but
  // tells the compiler nothing, so the reads below it were unchecked. The two
  // types are already known to match by this point.
  if (Array.isArray(value1) && Array.isArray(value2)) {
    if (value1.length !== value2.length) return false
    return value1.every((item, i) => isDeepEqual(item, value2[i], seen))
  }

  if (type1 === 'object') {
    // A plain object by `getTypeName`, so its keys are strings.
    const object1 = value1 as Record<string, unknown>
    const object2 = value2 as Record<string, unknown>
    const keyArr = Object.keys(object1)
    if (keyArr.length !== Object.keys(object2).length) return false
    return keyArr.every((key: string) => isDeepEqual(object1[key], object2[key], seen))
  }

  return Object.is(value1, value2)
}
