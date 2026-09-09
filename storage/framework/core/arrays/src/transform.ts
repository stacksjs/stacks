/**
 * Shaping an array: slicing it, grouping it, pairing it with another.
 *
 * `helpers.ts` holds the conversions and mutations, `math.ts` the statistics,
 * `contains.ts` the membership questions. These are the operations that were
 * reached for often enough that applications kept writing them inline, and
 * that a request to add Remeda (stacksjs/stacks#412) was really asking for -
 * answered by implementing them here rather than by taking a second utility
 * library and a second idiom for operations the framework already half had.
 *
 * Every function takes the array first and returns a new one. Nothing mutates
 * its input, and nothing throws on an empty array: an empty input produces an
 * empty output, or `undefined` where a single element was asked for.
 */

/**
 * Split an array into consecutive groups of at most `size`.
 *
 * The last group is short when the length does not divide evenly, which is the
 * behaviour that makes this useful for batching - a caller that wants only
 * whole groups can drop it.
 *
 * @category Array
 * @example
 * ```ts
 * chunk([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 * chunk([], 3)              // []
 * ```
 */
export function chunk<T>(array: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1)
    throw new TypeError(`chunk: size must be a positive integer, got ${size}`)

  const chunks: T[][] = []
  for (let index = 0; index < array.length; index += size)
    chunks.push(array.slice(index, index + size))
  return chunks
}

/**
 * Drop `null` and `undefined`, and say so in the type.
 *
 * Deliberately not "drop every falsy value", which is the other common reading:
 * that one silently removes `0`, `''` and `false`, which are ordinary data far
 * more often than they are mistakes, and it is `array.filter(Boolean)` when it
 * really is wanted. Narrowing to `NonNullable<T>` is the part a hand-written
 * filter does not give you.
 *
 * @category Array
 * @example
 * ```ts
 * compact([1, null, 2, undefined, 3]) // [1, 2, 3]
 * compact([0, '', false, null])       // [0, '', false]
 * ```
 */
export function compact<T>(array: readonly T[]): NonNullable<T>[] {
  return array.filter((value): value is NonNullable<T> => value !== null && value !== undefined)
}

/**
 * The first element, or `undefined` when there is none.
 *
 * The counterpart to the existing `last`. `array[0]` is the same thing until
 * `noUncheckedIndexedAccess` is on, at which point this is the version whose
 * type admits that an empty array has no first element.
 *
 * @category Array
 * @example
 * ```ts
 * first([1, 2, 3]) // 1
 * first([])        // undefined
 * ```
 */
export function first<T>(array: readonly T[]): T | undefined {
  return array[0]
}

/**
 * Everything after the first element.
 *
 * @category Array
 * @example
 * ```ts
 * tail([1, 2, 3]) // [2, 3]
 * tail([1])       // []
 * tail([])        // []
 * ```
 */
export function tail<T>(array: readonly T[]): T[] {
  return array.slice(1)
}

/**
 * The first `count` elements.
 *
 * A negative or zero `count` takes nothing, rather than counting from the end -
 * `slice`'s negative-index behaviour is a trap here, because `take(xs, -2)`
 * reads as "take two" and would silently return everything but the last two.
 *
 * @category Array
 * @example
 * ```ts
 * take([1, 2, 3, 4], 2)  // [1, 2]
 * take([1, 2, 3, 4], 10) // [1, 2, 3, 4]
 * take([1, 2, 3, 4], -2) // []
 * ```
 */
export function take<T>(array: readonly T[], count: number): T[] {
  return count <= 0 ? [] : array.slice(0, count)
}

/**
 * The last `count` elements, in their original order.
 *
 * @category Array
 * @example
 * ```ts
 * takeLast([1, 2, 3, 4], 2) // [3, 4]
 * takeLast([1, 2], 0)       // []
 * ```
 */
export function takeLast<T>(array: readonly T[], count: number): T[] {
  return count <= 0 ? [] : array.slice(Math.max(0, array.length - count))
}

/**
 * Elements from the start, stopping at the first that fails `predicate`.
 *
 * Stops rather than filters: a later element that would pass is not included,
 * which is the difference between this and `filter` and the whole reason to
 * reach for it.
 *
 * @category Array
 * @example
 * ```ts
 * takeWhile([1, 2, 5, 1], n => n < 3) // [1, 2]
 * ```
 */
export function takeWhile<T>(array: readonly T[], predicate: (value: T, index: number) => boolean): T[] {
  const result: T[] = []
  for (const [index, value] of array.entries()) {
    if (!predicate(value, index))
      break
    result.push(value)
  }
  return result
}

/**
 * Elements from the end, stopping at the last that fails `predicate`, returned
 * in their original order.
 *
 * @category Array
 * @example
 * ```ts
 * takeLastWhile([1, 5, 2, 1], n => n < 3) // [2, 1]
 * ```
 */
export function takeLastWhile<T>(array: readonly T[], predicate: (value: T, index: number) => boolean): T[] {
  for (let index = array.length - 1; index >= 0; index--) {
    if (!predicate(array[index] as T, index))
      return array.slice(index + 1)
  }
  return array.slice()
}

/**
 * Everything after the first `count` elements.
 *
 * @category Array
 * @example
 * ```ts
 * drop([1, 2, 3, 4], 2)  // [3, 4]
 * drop([1, 2, 3, 4], -1) // [1, 2, 3, 4]
 * ```
 */
export function drop<T>(array: readonly T[], count: number): T[] {
  return count <= 0 ? array.slice() : array.slice(count)
}

/**
 * Everything except the last `count` elements.
 *
 * @category Array
 * @example
 * ```ts
 * dropLast([1, 2, 3, 4], 2) // [1, 2]
 * ```
 */
export function dropLast<T>(array: readonly T[], count: number): T[] {
  return count <= 0 ? array.slice() : array.slice(0, Math.max(0, array.length - count))
}

/**
 * Everything from the first element that fails `predicate` onwards.
 *
 * @category Array
 * @example
 * ```ts
 * dropWhile([1, 2, 5, 1], n => n < 3) // [5, 1]
 * ```
 */
export function dropWhile<T>(array: readonly T[], predicate: (value: T, index: number) => boolean): T[] {
  for (const [index, value] of array.entries()) {
    if (!predicate(value, index))
      return array.slice(index)
  }
  return []
}

/**
 * Everything up to the last element that fails `predicate`.
 *
 * @category Array
 * @example
 * ```ts
 * dropLastWhile([1, 5, 2, 1], n => n < 3) // [1, 5]
 * ```
 */
export function dropLastWhile<T>(array: readonly T[], predicate: (value: T, index: number) => boolean): T[] {
  for (let index = array.length - 1; index >= 0; index--) {
    if (!predicate(array[index] as T, index))
      return array.slice(0, index + 1)
  }
  return []
}

/**
 * Group elements under the key each one produces.
 *
 * Insertion order is preserved within every group, and a key of `undefined`
 * drops the element rather than creating an `"undefined"` bucket - which is
 * what lets this double as a filter-and-group in one pass.
 *
 * @category Array
 * @example
 * ```ts
 * groupBy([1, 2, 3, 4], n => n % 2 ? 'odd' : 'even')
 * // { odd: [1, 3], even: [2, 4] }
 * ```
 */
export function groupBy<T, K extends PropertyKey>(
  array: readonly T[],
  key: (value: T, index: number) => K | undefined,
): Partial<Record<K, T[]>> {
  const groups: Partial<Record<K, T[]>> = {}
  for (const [index, value] of array.entries()) {
    const group = key(value, index)
    if (group === undefined)
      continue
    ;(groups[group] ??= []).push(value)
  }
  return groups
}

/**
 * Index elements by the key each one produces, last one winning.
 *
 * Last-wins rather than first-wins because this is normally used to build a
 * lookup from a list that is already in priority order, and because it matches
 * what an assignment loop would do.
 *
 * @category Array
 * @example
 * ```ts
 * keyBy([{ id: 'a', n: 1 }, { id: 'b', n: 2 }], user => user.id)
 * // { a: { id: 'a', n: 1 }, b: { id: 'b', n: 2 } }
 * ```
 */
export function keyBy<T, K extends PropertyKey>(
  array: readonly T[],
  key: (value: T, index: number) => K | undefined,
): Partial<Record<K, T>> {
  const indexed: Partial<Record<K, T>> = {}
  for (const [index, value] of array.entries()) {
    const at = key(value, index)
    if (at !== undefined)
      indexed[at] = value
  }
  return indexed
}

/**
 * How many elements produce each key.
 *
 * @category Array
 * @example
 * ```ts
 * countBy(['a', 'bb', 'c'], word => word.length) // { 1: 2, 2: 1 }
 * ```
 */
export function countBy<T, K extends PropertyKey>(
  array: readonly T[],
  key: (value: T, index: number) => K | undefined,
): Partial<Record<K, number>> {
  const counts: Partial<Record<K, number>> = {}
  for (const [index, value] of array.entries()) {
    const at = key(value, index)
    if (at !== undefined)
      counts[at] = (counts[at] ?? 0) + 1
  }
  return counts
}

/** How one `sortBy` selector orders: the value to compare, and the direction. */
export type SortSelector<T> = ((value: T) => number | string | bigint | boolean | Date) | {
  by: (value: T) => number | string | bigint | boolean | Date
  order?: 'asc' | 'desc'
}

function compareSelected(a: unknown, b: unknown): number {
  if (a instanceof Date && b instanceof Date)
    return a.getTime() - b.getTime()
  if (typeof a === 'string' && typeof b === 'string')
    return a < b ? -1 : a > b ? 1 : 0
  if (typeof a === 'boolean' && typeof b === 'boolean')
    return Number(a) - Number(b)
  if (typeof a === 'bigint' && typeof b === 'bigint')
    return a < b ? -1 : a > b ? 1 : 0
  return Number(a) - Number(b)
}

/**
 * Sort by one or more selectors, without mutating the input.
 *
 * `Array.prototype.sort` sorts in place and compares stringified values, so
 * `[10, 9].sort()` is `[10, 9]`. This copies first and compares the selected
 * values by their own type, falling through to the next selector on a tie -
 * which is what makes "by role, then by name" a single call.
 *
 * @category Array
 * @example
 * ```ts
 * sortBy(users, user => user.age)
 * sortBy(users, { by: user => user.age, order: 'desc' }, user => user.name)
 * ```
 */
export function sortBy<T>(array: readonly T[], ...selectors: SortSelector<T>[]): T[] {
  const normalized = selectors.map(selector =>
    typeof selector === 'function' ? { by: selector, order: 'asc' as const } : { order: 'asc' as const, ...selector },
  )

  return array.slice().sort((left, right) => {
    for (const { by, order } of normalized) {
      const comparison = compareSelected(by(left), by(right))
      if (comparison !== 0)
        return order === 'desc' ? -comparison : comparison
    }
    return 0
  })
}

/**
 * Sum the number each element produces.
 *
 * `0` for an empty array, which is the identity for addition and lets a caller
 * total a filtered list without checking whether anything survived.
 *
 * @category Array
 * @example
 * ```ts
 * sumBy(orders, order => order.total) // 41.5
 * ```
 */
export function sumBy<T>(array: readonly T[], value: (item: T, index: number) => number): number {
  let total = 0
  for (const [index, item] of array.entries())
    total += value(item, index)
  return total
}

/**
 * The mean of the number each element produces, or `undefined` when empty.
 *
 * `undefined` rather than `NaN` or a throw: an empty list has no mean, and a
 * caller that has to handle that is better served by a type that says so than
 * by a number that poisons every later arithmetic.
 *
 * @category Array
 * @example
 * ```ts
 * meanBy(orders, order => order.total) // 20.75
 * meanBy([], order => order.total)     // undefined
 * ```
 */
export function meanBy<T>(array: readonly T[], value: (item: T, index: number) => number): number | undefined {
  return array.length === 0 ? undefined : sumBy(array, value) / array.length
}

/**
 * The element with the largest selected value, or `undefined` when empty.
 *
 * Returns the *element*, not the value - which is the difference from `max`
 * and the reason to reach for it. Ties go to the first, so the result is stable
 * for an already-ordered input.
 *
 * @category Array
 * @example
 * ```ts
 * maxBy(users, user => user.age) // the oldest user
 * ```
 */
export function maxBy<T>(array: readonly T[], value: (item: T, index: number) => number): T | undefined {
  let best: T | undefined
  let bestValue = Number.NEGATIVE_INFINITY
  for (const [index, item] of array.entries()) {
    const candidate = value(item, index)
    if (candidate > bestValue) {
      bestValue = candidate
      best = item
    }
  }
  return best
}

/**
 * The element with the smallest selected value, or `undefined` when empty.
 *
 * @category Array
 * @example
 * ```ts
 * minBy(users, user => user.age) // the youngest user
 * ```
 */
export function minBy<T>(array: readonly T[], value: (item: T, index: number) => number): T | undefined {
  let best: T | undefined
  let bestValue = Number.POSITIVE_INFINITY
  for (const [index, item] of array.entries()) {
    const candidate = value(item, index)
    if (candidate < bestValue) {
      bestValue = candidate
      best = item
    }
  }
  return best
}

/**
 * Pair up two arrays, stopping at the shorter one.
 *
 * @category Array
 * @example
 * ```ts
 * zip([1, 2, 3], ['a', 'b']) // [[1, 'a'], [2, 'b']]
 * ```
 */
export function zip<A, B>(first: readonly A[], second: readonly B[]): Array<[A, B]> {
  const length = Math.min(first.length, second.length)
  const pairs: Array<[A, B]> = []
  for (let index = 0; index < length; index++)
    pairs.push([first[index] as A, second[index] as B])
  return pairs
}

/**
 * Combine two arrays element-wise, stopping at the shorter one.
 *
 * @category Array
 * @example
 * ```ts
 * zipWith([1, 2], [10, 20], (a, b) => a + b) // [11, 22]
 * ```
 */
export function zipWith<A, B, R>(
  first: readonly A[],
  second: readonly B[],
  combine: (a: A, b: B, index: number) => R,
): R[] {
  const length = Math.min(first.length, second.length)
  const combined: R[] = []
  for (let index = 0; index < length; index++)
    combined.push(combine(first[index] as A, second[index] as B, index))
  return combined
}

/**
 * The inverse of {@link zip}: pairs back into two arrays.
 *
 * @category Array
 * @example
 * ```ts
 * unzip([[1, 'a'], [2, 'b']]) // [[1, 2], ['a', 'b']]
 * ```
 */
export function unzip<A, B>(pairs: ReadonlyArray<readonly [A, B]>): [A[], B[]] {
  const first: A[] = []
  const second: B[] = []
  for (const [a, b] of pairs) {
    first.push(a)
    second.push(b)
  }
  return [first, second]
}

/**
 * Elements of `array` that are not in `other`, keeping duplicates.
 *
 * Membership is `Set` identity - `SameValueZero`, so `NaN` matches `NaN` and
 * `0` matches `-0`, and two structurally equal objects do not match. A caller
 * comparing objects wants a selector, not this.
 *
 * @category Array
 * @example
 * ```ts
 * difference([1, 2, 2, 3], [2]) // [1, 3]
 * ```
 */
export function difference<T>(array: readonly T[], other: readonly T[]): T[] {
  const exclude = new Set(other)
  return array.filter(value => !exclude.has(value))
}

/**
 * Elements present in both, in the order of the first, without duplicates.
 *
 * @category Array
 * @example
 * ```ts
 * intersection([1, 2, 2, 3], [2, 3, 4]) // [2, 3]
 * ```
 */
export function intersection<T>(array: readonly T[], other: readonly T[]): T[] {
  const include = new Set(other)
  const seen = new Set<T>()
  return array.filter((value) => {
    if (!include.has(value) || seen.has(value))
      return false
    seen.add(value)
    return true
  })
}

/**
 * Every element across the given arrays, in first-seen order, without
 * duplicates.
 *
 * @category Array
 * @example
 * ```ts
 * union([1, 2], [2, 3], [3, 4]) // [1, 2, 3, 4]
 * ```
 */
export function union<T>(...arrays: ReadonlyArray<readonly T[]>): T[] {
  return [...new Set(arrays.flat() as T[])]
}

/**
 * Cut an array in two at `index`.
 *
 * A negative index counts from the end, matching `slice`; out of range in
 * either direction gives one empty half rather than throwing.
 *
 * @category Array
 * @example
 * ```ts
 * splitAt([1, 2, 3, 4], 2)  // [[1, 2], [3, 4]]
 * splitAt([1, 2, 3, 4], -1) // [[1, 2, 3], [4]]
 * ```
 */
export function splitAt<T>(array: readonly T[], index: number): [T[], T[]] {
  return [array.slice(0, index), array.slice(index)]
}

/**
 * Cut an array in two at the first element that satisfies `predicate`, which
 * begins the second half.
 *
 * When nothing satisfies it, everything lands in the first half - so the two
 * halves always concatenate back to the input.
 *
 * @category Array
 * @example
 * ```ts
 * splitWhen([1, 2, 3, 1], n => n > 2) // [[1, 2], [3, 1]]
 * splitWhen([1, 2], n => n > 9)       // [[1, 2], []]
 * ```
 */
export function splitWhen<T>(array: readonly T[], predicate: (value: T, index: number) => boolean): [T[], T[]] {
  for (const [index, value] of array.entries()) {
    if (predicate(value, index))
      return [array.slice(0, index), array.slice(index)]
  }
  return [array.slice(), []]
}

/**
 * Build an array by calling `create` with each index.
 *
 * @category Array
 * @example
 * ```ts
 * times(3, index => index * 2) // [0, 2, 4]
 * ```
 */
export function times<T>(count: number, create: (index: number) => T): T[] {
  if (!Number.isInteger(count) || count < 0)
    throw new TypeError(`times: count must be a non-negative integer, got ${count}`)

  const result: T[] = Array.from({ length: count })
  for (let index = 0; index < count; index++)
    result[index] = create(index)
  return result
}
