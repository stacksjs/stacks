import type { Arrayable, Nullable } from '@stacksjs/types'
import type { PartitionFilter } from './helpers'
import { contains, containsAll, containsAny, containsNone, containsOnly, doesNotContain } from './contains'
import {
  at,
  clampArrayRange,
  flatten,
  last,
  mergeArrayable,
  move,
  partition,
  remove,
  sample,
  shuffle,
  toArray,
  uniq,
  uniqueBy,
} from './helpers'
import { average, median, mode, range, sum } from './math'

export const Arr = {
  contains(needle: string, haystack: string[]): boolean {
    return contains(needle, haystack)
  },

  containsAll(needles: string[], haystack: string[]): boolean {
    return containsAll(needles, haystack)
  },

  containsAny(needles: string[], haystack: string[]): boolean {
    return containsAny(needles, haystack)
  },

  containsNone(needles: string[], haystack: string[]): boolean {
    return containsNone(needles, haystack)
  },

  containsOnly(needles: string[], haystack: string[]): boolean {
    return containsOnly(needles, haystack)
  },

  doesNotContain(needle: string, haystack: string[]): boolean {
    return doesNotContain(needle, haystack)
  },

  toArray<T>(array?: Nullable<Arrayable<T>>): Array<T> {
    return toArray(array)
  },

  flatten<T>(array?: Nullable<Arrayable<T | T[]>>): T[] {
    return flatten(array)
  },

  mergeArrayable<T>(...args: Nullable<Arrayable<T>>[]): Array<T> {
    return mergeArrayable(...args)
  },

  partition<T>(array: readonly T[], filter: PartitionFilter<T>): [T[], T[]] {
    return partition(array, filter)
  },

  /**
   * Returns a random item/s from the array
   */
  random<T>(arr: T[], count = 1): T[] {
    return sample(arr, count).filter((item): item is T => item != null)
  },

  /**
   * Returns random item/s from the array
   */
  sample<T>(arr: T[], count = 1): T[] {
    return sample(arr, count)
  },

  unique<T>(arr: T[]): T[] {
    return uniq(arr)
  },

  uniqueBy<T>(arr: readonly T[], equalFn: (a: any, b: any) => boolean): T[] {
    return uniqueBy(arr, equalFn)
  },

  last<T>(arr: T[]): T | undefined {
    return last(arr)
  },

  remove<T>(arr: T[], value: T): boolean {
    return remove(arr, value)
  },

  at(arr: any[], index: number): any {
    return at(arr, index)
  },

  range(arr: readonly number[]): number {
    return range(arr)
  },

  move<T>(arr: T[], from: number, to: number): T[] {
    return move(arr, from, to)
  },

  clampArrayRange(arr: readonly unknown[], n: number): number {
    return clampArrayRange(arr, n)
  },

  shuffle<T>(arr: T[]): T[] {
    return shuffle(arr)
  },

  /**
   * Returns the sum of all items in the array
   */
  sum(arr: number[]): number {
    return sum(arr)
  },

  /**
   * Returns the average of all items in the array
   */
  average(arr: number[]): number {
    return average(arr)
  },

  avg(arr: number[]): number {
    return average(arr)
  },

  /**
   * Returns the median of all items in the array
   */
  median(arr: number[]): number {
    return median(arr)
  },

  /**
   * Returns the mode of all items in the array
   */
  mode(arr: number[]): number {
    return mode(arr)
  },
}

export const arr: typeof Arr = Arr
