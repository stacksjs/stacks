import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

/**
 * Reactive current time.
 * Returns a ref that updates every `interval` milliseconds.
 *
 * @param options - Configuration with interval (default 1000ms)
 */
export function useNow(options?: { interval?: number }): Ref<Date> {
  const interval = options?.interval ?? 1000
  const now = ref<Date>(new Date())

  const timer = setInterval(() => {
    now.value = new Date()
  }, interval)

  try {
    onUnmounted(() => clearInterval(timer))
  }
  catch {
    // Not in a component context
  }

  return now
}
