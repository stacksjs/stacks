import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

/**
 * A ref with throttled updates.
 * Changes to the returned ref's value are propagated at most once every `delay` ms.
 * The last value set during a throttle period will be applied after the period ends.
 *
 * @param value - The initial value
 * @param delay - Throttle delay in milliseconds (default 200)
 * @returns A Ref whose internal value updates are throttled
 */
export function useThrottledRef<T>(value: T, delay: number = 200): Ref<T> {
  const source = ref(value) as Ref<T>
  const throttled = ref(value) as Ref<T>
  let lastUpdate = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  watch(source, (newVal) => {
    const now = Date.now()
    const elapsed = now - lastUpdate

    if (elapsed >= delay) {
      // Enough time has passed, update immediately
      lastUpdate = now
      throttled.value = newVal
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
    else if (timeoutId === null) {
      // Schedule a trailing update
      timeoutId = setTimeout(() => {
        lastUpdate = Date.now()
        throttled.value = source.value
        timeoutId = null
      }, delay - elapsed)
    }
  })

  // Return a proxy-like object that reads from throttled but writes to source
  return {
    get value(): T {
      return throttled.value
    },
    set value(newVal: T) {
      source.value = newVal
    },
    subscribe: throttled.subscribe,
  } as unknown as Ref<T>
}
