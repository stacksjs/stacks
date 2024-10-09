/**
 * Returns true if the needle is contained in the haystack.
 *
 * @param needle
 * @param haystack
 * @example
 * ```ts
 * contains('foo', ['foo', 'bar']) // true
 * contains('foo', ['bar']) // false
 * ```
 */
export function contains(needle: string, haystack: string[]): boolean {
  return haystack.some(hay => needle.includes(hay))
}

/**
 * Returns true if all needles are contained in the haystack.
 * @param needles
 * @param haystack
 * @example
 * ```ts
 * containsAll(['foo', 'bar'], ['foo', 'bar', 'baz']) // true
 * containsAll(['foo', 'bar'], ['foo', 'baz']) // false
 * ```
 */
export function containsAll(needles: string[], haystack: string[]): boolean {
  return needles.every(needle => contains(needle, haystack))
}

/**
 * Returns true if any needle is contained in the haystack.
 * @param needles
 * @param haystack
 * @example
 * ```ts
 * containsAny(['foo', 'bar'], ['foo', 'bar', 'baz']) // true
 * containsAny(['foo', 'bar'], ['foo', 'baz']) // true
 * containsAny(['foo', 'bar'], ['baz']) // false
 * ```
 */
export function containsAny(needles: string[], haystack: string[]): boolean {
  return needles.some(needle => contains(needle, haystack))
}

/**
 * Returns true if none of the needles are contained in the haystack.
 * @param needles
 * @param haystack
 * @example
 * ```ts
 * containsNone(['foo', 'bar'], ['foo', 'bar', 'baz']) // false
 * containsNone(['foo', 'bar'], ['foo', 'baz']) // false
 * containsNone(['foo', 'bar'], ['baz']) // true
 * ```
 */
export function containsNone(needles: string[], haystack: string[]): boolean {
  return !containsAny(needles, haystack)
}

/**
 * Returns true if all needles are contained in the haystack.
 * @param needles
 * @param haystack
 * @example
 * ```ts
 * containsOnly(['foo', 'bar'], ['foo', 'bar', 'baz']) // false
 * containsOnly(['foo', 'bar'], ['foo', 'baz']) // false
 * containsOnly(['foo', 'bar'], ['foo', 'bar']) // true
 * ```
 */
export function containsOnly(needles: string[], haystack: string[]): boolean {
  return containsAll(haystack, needles)
}

/**
 * Returns true if the needle is not contained in the haystack.
 * @param needle
 * @param haystack
 * @example
 * ```ts
 * doesNotContain('foo', ['foo', 'bar']) // false
 * doesNotContain('foo', ['bar']) // true
 * ```
 */
export function doesNotContain(needle: string, haystack: string[]): boolean {
  return !contains(needle, haystack)
}
