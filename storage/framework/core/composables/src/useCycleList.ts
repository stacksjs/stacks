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

  const state = computed<T>(() => list[index.value])

  function normalizeIndex(i: number): number {
    // Handle negative modulo properly
    return ((i % length) + length) % length
  }

  function next(n: number = 1): T {
    index.value = normalizeIndex(index.value + n)
    return list[index.value]
  }

  function prev(n: number = 1): T {
    index.value = normalizeIndex(index.value - n)
    return list[index.value]
  }

  function go(i: number): T {
    index.value = normalizeIndex(i)
    return list[index.value]
  }

  return { state, index, next, prev, go }
}
