import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

export interface UseCounterOptions {
  min?: number
  max?: number
}

export interface UseCounterReturn {
  count: Ref<number>
  inc: (delta?: number) => number
  dec: (delta?: number) => number
  set: (val: number) => number
  reset: (val?: number) => number
  get: () => number
}

/**
 * Reactive counter with increment, decrement, set, reset, and min/max bounds.
 *
 * @param initialValue - Starting value (default 0)
 * @param options - Optional min/max bounds
 */
export function useCounter(initialValue: number = 0, options: UseCounterOptions = {}): UseCounterReturn {
  const { min = -Infinity, max = Infinity } = options

  function clamp(val: number): number {
    return Math.min(max, Math.max(min, val))
  }

  const count = ref<number>(clamp(initialValue))

  function inc(delta: number = 1): number {
    count.value = clamp(count.value + delta)
    return count.value
  }

  function dec(delta: number = 1): number {
    count.value = clamp(count.value - delta)
    return count.value
  }

  function set(val: number): number {
    count.value = clamp(val)
    return count.value
  }

  function reset(val: number = initialValue): number {
    count.value = clamp(val)
    return count.value
  }

  function get(): number {
    return count.value
  }

  return { count, inc, dec, set, reset, get }
}
