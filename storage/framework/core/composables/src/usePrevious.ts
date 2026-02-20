import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

/**
 * Track the previous value of a ref.
 * Returns a ref containing the value before the last change.
 *
 * @param value - The source ref to track
 * @param initialValue - Optional initial value for the previous ref
 */
export function usePrevious<T>(value: Ref<T>, initialValue?: T): Ref<T | undefined> {
  const previous = ref<T | undefined>(initialValue) as Ref<T | undefined>

  watch(value, (_newVal, oldVal) => {
    previous.value = oldVal as T
  })

  return previous
}
