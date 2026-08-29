import { getTypeName } from '@stacksjs/types'

/**
 * Every item in `a` pairs with a distinct item in `b`.
 *
 * Used for Sets and for Maps with object keys, where there is no lookup to
 * reach for: membership is decided by comparing values, and each item on the
 * right may only answer for one item on the left. `consumed` is what enforces
 * that, so `new Set([{ a: 1 }])` does not match `new Set([{ a: 1 }, { a: 1 }])`
 * through the same element twice.
 */
function unorderedMatch<T>(a: readonly T[], b: readonly T[], matches: (_x: T, _y: T) => boolean): boolean {
  if (a.length !== b.length)
    return false

  const consumed: boolean[] = Array.from({ length: b.length }, () => false)

  for (const item of a) {
    let found = false

    for (let i = 0; i < b.length; i++) {
      if (consumed[i])
        continue

      if (matches(item, b[i] as T)) {
        consumed[i] = true
        found = true
        break
      }
    }

    if (!found)
      return false
  }

  return true
}

/** Two Maps hold the same entries, whatever order they were built in. */
function mapsEqual(a: Map<unknown, unknown>, b: Map<unknown, unknown>, seen: WeakMap<object, object>): boolean {
  if (a.size !== b.size)
    return false

  // Fast path: `b` has every key of `a` by identity, which is every Map keyed
  // by primitives. Only the values need comparing, and it stays linear.
  let sameKeys = true
  for (const key of a.keys()) {
    if (!b.has(key)) {
      sameKeys = false
      break
    }
  }

  if (sameKeys) {
    for (const [key, value] of a) {
      if (!isDeepEqual(value, b.get(key), seen))
        return false
    }

    return true
  }

  // Object keys, which no lookup can find: compare them structurally.
  return unorderedMatch(
    [...a.entries()],
    [...b.entries()],
    (x, y) => isDeepEqual(x[0], y[0], seen) && isDeepEqual(x[1], y[1], seen),
  )
}

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
 * - Dates, regular expressions, Maps and Sets are compared by what they
 *   HOLD. Only arrays and plain objects had branches, so everything else
 *   fell through to the `Object.is` tail — which for an object means
 *   reference identity. `isDeepEqual(new Date(0), new Date(0))` was
 *   therefore false, as were two equal `/a/g`s, two Maps with the same
 *   entries and two Sets with the same members. A Date nested anywhere
 *   inside a structure took the whole comparison down with it, which is
 *   how this stayed unnoticed: the common shapes are objects and arrays,
 *   and those worked. Typed arrays and ArrayBuffers compare by their bytes
 *   for the same reason.
 * - Errors and host objects (URL, Headers, Blob, …) are deliberately NOT
 *   handled and still compare by identity. Unlike the types above they have
 *   no single obvious structural identity - whether two Errors with the same
 *   message but different stacks are "equal" is a policy question, not a
 *   fact - and there is no end to the list. Guessing an answer silently is
 *   what made the cases above wrong.
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

  /*
   * Dispatched on `getTypeName` rather than `instanceof`, and cast after.
   *
   * `getTypeName` reads the object's internal tag, so it identifies a Date
   * that came from another realm - a worker, a vm context - which
   * `instanceof Date` does not. The check above has already established the
   * two tags match, so each cast below is asking about a type the value has
   * been shown to have. `Array.isArray` is the exception: it is specified to
   * work across realms, so the array branch needs no cast.
   */
  if (type1 === 'date') {
    /*
     * `Object.is`, so two Invalid Dates come out equal.
     *
     * An Invalid Date's time value is NaN, and NaN-safety is this function's
     * stated contract - `isDeepEqual(NaN, NaN)` is true by design. Being
     * NaN-safe for a bare NaN but not for one inside a Date would be an
     * inconsistency, so they agree.
     *
     * This is a deliberate divergence from `assert.deepStrictEqual`, which
     * calls two Invalid Dates unequal. Every other case here agrees with it.
     */
    return Object.is((value1 as Date).getTime(), (value2 as Date).getTime())
  }

  if (type1 === 'regexp') {
    // Pattern and flags. `lastIndex` is iteration state, not part of what the
    // expression matches.
    return (value1 as RegExp).source === (value2 as RegExp).source
      && (value1 as RegExp).flags === (value2 as RegExp).flags
  }

  if (type1 === 'map')
    return mapsEqual(value1 as Map<unknown, unknown>, value2 as Map<unknown, unknown>, seen)

  if (type1 === 'set') {
    return unorderedMatch(
      [...(value1 as Set<unknown>)],
      [...(value2 as Set<unknown>)],
      (x, y) => isDeepEqual(x, y, seen),
    )
  }

  /*
   * Binary data compares by its bytes.
   *
   * `ArrayBuffer.isView` reads an internal slot, so like `Array.isArray` it
   * holds across realms and needs no cast. The tag check above has already
   * separated a `Uint8Array` from an `Int8Array`, so both sides here are the
   * same view type and a byte-wise comparison is the right one - it also
   * makes two NaNs in a `Float64Array` equal, which matches the NaN handling
   * at the top of this function.
   */
  if (ArrayBuffer.isView(value1) && ArrayBuffer.isView(value2)) {
    const bytes1 = new Uint8Array(value1.buffer, value1.byteOffset, value1.byteLength)
    const bytes2 = new Uint8Array(value2.buffer, value2.byteOffset, value2.byteLength)
    if (bytes1.length !== bytes2.length) return false
    return bytes1.every((byte, i) => byte === bytes2[i])
  }

  if (type1 === 'arraybuffer') {
    const bytes1 = new Uint8Array(value1 as ArrayBuffer)
    const bytes2 = new Uint8Array(value2 as ArrayBuffer)
    if (bytes1.length !== bytes2.length) return false
    return bytes1.every((byte, i) => byte === bytes2[i])
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
