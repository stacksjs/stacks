import type { Ref } from '@stacksjs/stx'
import { computed, ref } from '@stacksjs/stx'

export interface UseCycleListOptions<T> {
  initialValue?: T
}

export interface UseCycleListReturn<T> {
  state: Ref<T>
  index: Ref<number>
  next: (n?: number) => T
  prev: (n?: number) => T
  go: (i: number) => T
}

/**
 * Cycle through a list of values with wrap-around.
 *
 * @param list - Array of values to cycle through
 * @param options - Optional initial value
 */
export function useCycleList<T>(list: T[], options: UseCycleListOptions<T> = {}): UseCycleListReturn<T> {
  const length = list.length
  if (length === 0) {
    throw new Error('useCycleList requires a non-empty list')
  }

  const initialIndex = options.initialValue !== undefined ? list.indexOf(options.initialValue) : 0
  const index = ref<number>(initialIndex >= 0 ? initialIndex : 0)

  // Safe because index is always normalized into [0, length) and length > 0
  function at(i: number): T {
    return list[i] as T
  }

  const state = computed<T>(() => at(index.value))

  function normalizeIndex(i: number): number {
    // Handle negative modulo properly
    return ((i % length) + length) % length
  }

  function next(n: number = 1): T {
    index.value = normalizeIndex(index.value + n)
    return at(index.value)
  }

  function prev(n: number = 1): T {
    index.value = normalizeIndex(index.value - n)
    return at(index.value)
  }

  function go(i: number): T {
    index.value = normalizeIndex(i)
    return at(index.value)
  }

  return { state, index, next, prev, go }
}
