import type { Arrayable, Nullable } from '@stacksjs/types'
import { clamp } from '@stacksjs/utils'

/**
 * Convert `Arrayable<T>` to `Array<T>`
 *
 * @category Array
 * @example
 * ```ts
 * toArray('foo') // ['foo']
 * toArray(['foo']) // ['foo']
 * toArray(null) // []
 * toArray(undefined) // []
 * toArray(1) // [1]
 * toArray([1]) // [1]
 * toArray({ foo: 'bar' }) // [{ foo: 'bar' }]
 * toArray([{ foo: 'bar' }]) // [{ foo: 'bar' }]
 * ```
 */
export function toArray<T>(array?: Nullable<Arrayable<T>>): Array<T> {
  array = array ?? []
  return Array.isArray(array) ? array : [array]
}

/**
 * Flatten `Arrayable<T>` to `Array<T>`
 *
 * @category Array
 * @example
 * ```ts
 * flatten([1, [2, [3, [4, [5]]]]]) // [1, 2, 3, 4, 5]
 * ```
 */
export function flatten<T>(array?: Nullable<Arrayable<T | T[]>>): T[] {
  return toArray(array).reduce((acc: T[], val) => acc.concat(Array.isArray(val) ? flatten(val) : (val as T)), [])
}

/**
 * Use rest arguments to merge arrays
 *
 * @category Array
 * @example
 * ```ts
 * mergeArrayable([1, 2], [3, 4], [5, 6]) // [1, 2, 3, 4, 5, 6]
 * ```
 */
export function mergeArrayable<T>(...args: Nullable<Arrayable<T>>[]): Array<T> {
  return args.flatMap(i => toArray(i))
}

export type PartitionFilter<T> = (i: T, idx: number, arr: readonly T[]) => any

/**
 * Divide an array into two parts by a filter function
 *
 * @category Array
 * @example
 * ```ts
 * const [odd, even] = partition([1, 2, 3, 4], i => i % 2 != 0)
 * console.log(odd) // [1, 3]
 * console.log(even) // [2, 4]
 * ```
 */
export function partition<T>(array: readonly T[], f1: PartitionFilter<T>): [T[], T[]]
export function partition<T>(array: readonly T[], f1: PartitionFilter<T>, f2: PartitionFilter<T>): [T[], T[], T[]]
export function partition<T>(
  array: readonly T[],
  f1: PartitionFilter<T>,
  f2: PartitionFilter<T>,
  f3: PartitionFilter<T>,
): [T[], T[], T[], T[]]
export function partition<T>(
  array: readonly T[],
  f1: PartitionFilter<T>,
  f2: PartitionFilter<T>,
  f3: PartitionFilter<T>,
  f4: PartitionFilter<T>,
): [T[], T[], T[], T[], T[]]
export function partition<T>(
  array: readonly T[],
  f1: PartitionFilter<T>,
  f2: PartitionFilter<T>,
  f3: PartitionFilter<T>,
  f4: PartitionFilter<T>,
  f5: PartitionFilter<T>,
): [T[], T[], T[], T[], T[], T[]]
export function partition<T>(
  array: readonly T[],
  f1: PartitionFilter<T>,
  f2: PartitionFilter<T>,
  f3: PartitionFilter<T>,
  f4: PartitionFilter<T>,
  f5: PartitionFilter<T>,
  f6: PartitionFilter<T>,
): [T[], T[], T[], T[], T[], T[], T[]]
export function partition<T>(array: readonly T[], ...filters: PartitionFilter<T>[]): any {
  const result: T[][] = Array.from({ length: filters.length + 1 })
    .fill(null)
    .map(() => [])

  array.forEach((e, idx, arr) => {
    let i = 0
    for (const filter of filters) {
      if (filter(e, idx, arr)) {
        ;(result[i] as T[]).push(e)
        return
      }
      i += 1
    }
    ;(result[i] as T[]).push(e)
  })
  return result
}

/**
 * Unique an Array
 *
 * @category Array
 * @example
 * ```ts
 * uniq([1, 2, 3, 3, 2, 1]) // [1, 2, 3]
 * ```
 */
export function uniq<T>(array: readonly T[]): T[] {
  return Array.from(new Set(array))
}

/**
 * Unique an Array
 *
 * @param array
 * @example
 * ```ts
 * unique([1, 2, 3, 3, 2, 1]) // [1, 2, 3]
 * ```
 */
export function unique<T>(array: readonly T[]): T[] {
  return uniq(array)
}

/**
 * Unique an Array by a custom equality function
 *
 * @category Array
 * @example
 * ```ts
 * uniqueBy([1, 2, 3, 3, 2, 1], (a, b) => a === b) // [1, 2, 3]
 * ```
 */
export function uniqueBy<T>(array: readonly T[], equalFn: (a: any, b: any) => boolean): T[] {
  return array.reduce((acc: T[], cur: any) => {
    const index = acc.findIndex((item: any) => equalFn(cur, item))
    if (index === -1)
      acc.push(cur)
    return acc
  }, [])
}

/**
 * Get last item
 *
 * @category Array
 * @example
 * ```ts
 * last([1, 2, 3]) // 3
 * ```
 */
export function last(array: readonly []): undefined
export function last<T>(array: readonly T[]): T
export function last<T>(array: readonly T[]): T | undefined {
  return at(array, -1)
}

/**
 * Remove an item from Array
 *
 * @category Array
 * @example
 * ```ts
 * const arr = [1, 2, 3]
 * remove(arr, 2) // true
 * Arr.remove(arr, 4) // false
 * console.log(arr) // [1, 3]
 */
export function remove<T>(array: T[], value: T): boolean {
  if (!array)
    return false

  const index = array.indexOf(value)
  if (index >= 0) {
    array.splice(index, 1)
    return true
  }

  return false
}

/**
 * Get nth item of Array. Negative for backward
 *
 * @category Array
 * @example
 * ```ts
 * at([1, 2, 3], 1) // 2
 * at([1, 2, 3], -1) // 3
 * at([1, 2, 3], 3) // undefined
 * at([1, 2, 3], -4) // undefined
 * ```
 */
export function at(array: readonly [], index: number): undefined
export function at<T>(array: readonly T[], index: number): T
export function at<T>(array: readonly T[] | [], index: number): T | undefined {
  const len = array.length
  if (!len)
    return undefined

  if (index < 0)
    index += len

  return array[index]
}

/**
 * Move an item from one index to another
 * @param array
 * @param from
 * @param to
 *
 * @category Array
 * @example
 * ```ts
 * move([1, 2, 3, 4], 0, 2) // [2, 3, 1, 4]
 * move([1, 2, 3, 4], 0, -1) // [2, 3, 4, 1]
 * move([1, 2, 3, 4], -1, 0) // [4, 1, 2, 3]
 * move([1, 2, 3, 4], -1, -2) // [1, 4, 2, 3]
 * move([1, 2, 3, 4], 1, 1) // [1, 2, 3, 4]
 * ```
 */
export function move<T>(array: T[], from: number, to: number): T[] {
  const len = array.length
  if (!len)
    return []

  if (from < 0)
    from += len

  if (to < 0)
    to += len

  const item = array.splice(from, 1)[0]
  array.splice(to, 0, item as T)
  return array
}

/**
 * Clamp a number to the index range of an array.
 *
 * @category Array
 * @example
 * ```ts
 * clampArrayRange([1, 2, 3], 0) // 0
 * clampArrayRange([1, 2, 3], 1) // 1
 * clampArrayRange([1, 2, 3], 2) // 2
 * clampArrayRange([1, 2, 3], 3) // 2
 * clampArrayRange([1, 2, 3], 4) // 2
 * clampArrayRange([1, 2, 3], -1) // 0
 */
export function clampArrayRange(arr: readonly unknown[], n: number): number {
  return clamp(n, 0, arr.length - 1)
}

/**
 * Get random items from an array
 *
 * @category Array
 * @example
 * ```ts
 * sample([1, 2, 3, 4], 2) // [2, 3]
 * ```
 */
export function sample<T>(arr: T[], count: number): T[] {
  return Array.from({ length: count }, () => arr[Math.floor(Math.random() * arr.length)]!)
}

/**
 * Shuffle an array. This function mutates the array.
 *
 * @category Array
 * @example
 * ```ts
 * shuffle([1, 2, 3, 4]) // [2, 4, 1, 3]
 * ```
 */
export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i] as T, array[j] as T] = [array[j] as T, array[i] as T]
  }
  return array
}
