import type { Arrayable, Nullable } from '@stacksjs/types'
import { clamp } from '@stacksjs/utils'
import { Macroable } from 'macroable'

export class Arr extends Macroable {
  contains(needle: string, haystack: string[]) {
    return contains(needle, haystack)
  }

  containsAll(needles: string[], haystack: string[]) {
    return containsAll(needles, haystack)
  }

  containsAny(needles: string[], haystack: string[]) {
    return containsAny(needles, haystack)
  }

  containsNone(needles: string[], haystack: string[]) {
    return containsNone(needles, haystack)
  }

  containsOnly(needles: string[], haystack: string[]) {
    return containsOnly(needles, haystack)
  }

  doesNotContain(needle: string, haystack: string[]) {
    return doesNotContain(needle, haystack)
  }

  toArray<T>(array?: Nullable<Arrayable<T>>): Array<T> {
    return toArray(array)
  }

  flatten<T>(array?: Nullable<Arrayable<T | Array<T>>>): Array<T> {
    return flatten(array)
  }

  mergeArrayable<T>(...args: Nullable<Arrayable<T>>[]): Array<T> {
    return mergeArrayable(...args)
  }

  partition<T>(array: readonly T[], filter: PartitionFilter<T>): [T[], T[]] {
    return partition(array, filter)
  }

  /**
   * Returns a random item/s from the array
   */
  random<T>(arr: T[], count = 1): T[] {
    return sample(arr, count)
  }

  /**
   * Returns random item/s from the array
   */
  sample<T>(arr: T[], count = 1): T[] {
    return sample(arr, count)
  }

  unique<T>(arr: T[]): T[] {
    return uniq(arr)
  }

  uniqueBy<T>(arr: readonly T[], equalFn: (a: any, b: any) => boolean): T[] {
    return uniqueBy(arr, equalFn)
  }

  last<T>(arr: T[]): T | undefined {
    return last(arr)
  }

  remove<T>(arr: T[], value: T) {
    return remove(arr, value)
  }

  at(arr: any[], index: number): any {
    return at(arr, index)
  }

  range(start: number, end: number, step = 1): number[] {
    return range(start, end, step)
  }

  move<T>(arr: T[], from: number, to: number): T[] {
    return move(arr, from, to)
  }

  clampArrayRange(arr: readonly unknown[], n: number) {
    return clampArrayRange(arr, n)
  }

  shuffle<T>(arr: T[]): T[] {
    return shuffle(arr)
  }

  /**
   * Returns the sum of all items in the array
   */
  sum(arr: number[]): number {
    return sum(arr)
  }

  /**
   * Returns the average of all items in the array
   */
  average(arr: number[]): number {
    return average(arr)
  }

  avg(arr: number[]): number {
    return average(arr)
  }

  /**
   * Returns the median of all items in the array
   */
  median(arr: number[]): number {
    return median(arr)
  }

  /**
   * Returns the mode of all items in the array
   */
  mode(arr: number[]): number {
    return mode(arr)
  }
}

export const arr = new Arr()

export function average(arr: number[]): number {
  return sum(arr) / arr.length
}

export function avg(arr: number[]): number {
  return average(arr)
}

export function median(arr: number[]): number {
  return arr[Math.floor(arr.length / 2)]
}

export function mode(arr: number[]): number {
  return arr.sort((a, b) => arr.filter(v => v === a).length - arr.filter(v => v === b).length).pop()!
}

export function contains(needle: string, haystack: string[]) {
  return haystack.some(hay => needle.includes(hay))
}

export function containsAll(needles: string[], haystack: string[]) {
  return needles.every(needle => contains(needle, haystack))
}

export function containsAny(needles: string[], haystack: string[]) {
  return needles.some(needle => contains(needle, haystack))
}

export function containsNone(needles: string[], haystack: string[]) {
  return !containsAny(needles, haystack)
}

export function containsOnly(needles: string[], haystack: string[]) {
  return containsAll(haystack, needles)
}

export function doesNotContain(needle: string, haystack: string[]) {
  return !contains(needle, haystack)
}

/**
 * Convert `Arrayable<T>` to `Array<T>`
 *
 * @category Array
 */
export function toArray<T>(array?: Nullable<Arrayable<T>>): Array<T> {
  array = array ?? []
  return Array.isArray(array) ? array : [array]
}

/**
 * Convert `Arrayable<T>` to `Array<T>` and flatten it
 *
 * @category Array
 */
export function flatten<T>(array?: Nullable<Arrayable<T | Array<T>>>): Array<T> {
  return toArray(array).flat(1) as Array<T>
}

/**
 * Use rest arguments to merge arrays
 *
 * @category Array
 */
export function mergeArrayable<T>(...args: Nullable<Arrayable<T>>[]): Array<T> {
  return args.flatMap(i => toArray(i))
}

export type PartitionFilter<T> = (i: T, idx: number, arr: readonly T[]) => any

/**
 * Divide an array into two parts by a filter function
 *
 * @category Array
 * @example const [odd, even] = partition([1, 2, 3, 4], i => i % 2 != 0)
 */
export function partition<T>(array: readonly T[], f1: PartitionFilter<T>): [T[], T[]]
export function partition<T>(array: readonly T[], f1: PartitionFilter<T>, f2: PartitionFilter<T>): [T[], T[], T[]]
export function partition<T>(array: readonly T[], f1: PartitionFilter<T>, f2: PartitionFilter<T>, f3: PartitionFilter<T>): [T[], T[], T[], T[]]
export function partition<T>(array: readonly T[], f1: PartitionFilter<T>, f2: PartitionFilter<T>, f3: PartitionFilter<T>, f4: PartitionFilter<T>): [T[], T[], T[], T[], T[]]
export function partition<T>(array: readonly T[], f1: PartitionFilter<T>, f2: PartitionFilter<T>, f3: PartitionFilter<T>, f4: PartitionFilter<T>, f5: PartitionFilter<T>): [T[], T[], T[], T[], T[], T[]]
export function partition<T>(array: readonly T[], f1: PartitionFilter<T>, f2: PartitionFilter<T>, f3: PartitionFilter<T>, f4: PartitionFilter<T>, f5: PartitionFilter<T>, f6: PartitionFilter<T>): [T[], T[], T[], T[], T[], T[], T[]]
export function partition<T>(array: readonly T[], ...filters: PartitionFilter<T>[]): any {
  const result: T[][] = new Array(filters.length + 1).fill(null).map(() => [])

  array.forEach((e, idx, arr) => {
    let i = 0
    for (const filter of filters) {
      if (filter(e, idx, arr)) {
        result[i].push(e)
        return
      }
      i += 1
    }
    result[i].push(e)
  })
  return result
}

/**
 * Unique an Array
 *
 * @category Array
 */
export function uniq<T>(array: readonly T[]): T[] {
  return Array.from(new Set(array))
}

/**
 * Unique an Array by a custom equality function
 *
 * @category Array
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
 */
export function remove<T>(array: T[], value: T) {
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
 * Generate a range array of numbers. The `stop` is exclusive.
 *
 * @category Array
 */
export function range(stop: number): number[]
export function range(start: number, stop: number, step?: number): number[]
export function range(...args: any): number[] {
  let start: number, stop: number, step: number

  if (args.length === 1) {
    start = 0
    step = 1;
    ([stop] = args)
  }
  else {
    ([start, stop, step = 1] = args)
  }

  const arr: number[] = []
  let current = start
  while (current < stop) {
    arr.push(current)
    current += step || 1
  }

  return arr
}

export function sum(array: readonly number[]): number {
  return array.reduce((acc, cur) => acc + cur, 0)
}

/**
 * Move element in an Array
 *
 * @category Array
 * @param arr
 * @param from
 * @param to
 */
export function move<T>(arr: T[], from: number, to: number) {
  arr.splice(to, 0, arr.splice(from, 1)[0])
  return arr
}

/**
 * Clamp a number to the index range of an array.
 *
 * @category Array
 */
export function clampArrayRange(arr: readonly unknown[], n: number) {
  return clamp(n, 0, arr.length - 1)
}

/**
 * Get random items from an array
 *
 * @category Array
 */
export function sample<T>(arr: T[], count: number) {
  return Array.from({ length: count }, _ => arr[Math.round(Math.random() * (arr.length - 1))])
}

/**
 * Shuffle an array. This function mutates the array.
 *
 * @category Array
 */
export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

export default Arr
