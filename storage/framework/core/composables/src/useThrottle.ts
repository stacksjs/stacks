import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { isRef, unref } from './_shared'

/**
 * Throttle a value. Returns a ref that updates at most once per interval.
 *
 * @param value - The source value or ref
 * @param ms - Throttle interval in milliseconds. Default: 200
 */
export function useThrottle<T>(value: MaybeRef<T>, ms: number = 200): Ref<T> {
  const throttled = ref(unref(value)) as Ref<T>
  let lastUpdate = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  if (isRef(value)) {
    watch(value as Ref<T>, (newVal) => {
      const now = Date.now()
      const elapsed = now - lastUpdate

      if (elapsed >= ms) {
        throttled.value = newVal
        lastUpdate = now
      }
      else {
        if (timer !== null) clearTimeout(timer)
        timer = setTimeout(() => {
          throttled.value = (value as Ref<T>).value
          lastUpdate = Date.now()
          timer = null
        }, ms - elapsed)
      }
    })
  }

  return throttled
}
