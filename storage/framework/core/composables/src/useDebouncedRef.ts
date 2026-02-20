import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

/**
 * A ref with debounced updates.
 * Changes to the returned ref's value are propagated after a delay.
 * Rapidly setting the value resets the delay timer.
 *
 * @param value - The initial value
 * @param delay - Debounce delay in milliseconds (default 200)
 * @returns A Ref whose internal value updates are debounced
 */
export function useDebouncedRef<T>(value: T, delay: number = 200): Ref<T> {
  const source = ref(value) as Ref<T>
  const debounced = ref(value) as Ref<T>
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  watch(source, (newVal) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      debounced.value = newVal
      timeoutId = null
    }, delay)
  })

  // Return a proxy-like object that reads from debounced but writes to source
  return {
    get value(): T {
      return debounced.value
    },
    set value(newVal: T) {
      source.value = newVal
    },
    subscribe: debounced.subscribe,
  } as unknown as Ref<T>
}
