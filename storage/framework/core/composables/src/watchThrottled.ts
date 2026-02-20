import type { Ref } from '@stacksjs/stx'
import { watch } from '@stacksjs/stx'

export interface WatchThrottledOptions {
  /**
   * Throttle interval in milliseconds.
   * @default 200
   */
  throttle?: number
}

/**
 * Watch a source with throttled callback invocation.
 * The callback is called at most once per throttle interval.
 * A trailing call is scheduled if changes occur during the throttle window.
 *
 * @param source - The reactive source to watch
 * @param callback - The callback to invoke (throttled)
 * @param options - Configuration options
 * @returns A stop function that cleans up both the watch and any pending timer
 *
 * @example
 * ```ts
 * const scrollY = ref(0)
 * watchThrottled(scrollY, (value) => {
 *   updateHeader(value)
 * }, { throttle: 100 })
 * ```
 */
export function watchThrottled<T>(
  source: Ref<T>,
  callback: (value: T) => void,
  options?: WatchThrottledOptions,
): () => void {
  const interval = options?.throttle ?? 200
  let lastExec = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let latestValue: T | undefined
  let hasPending = false

  const unwatch = watch(source, (newValue) => {
    const now = Date.now()
    const elapsed = now - lastExec

    if (elapsed >= interval) {
      lastExec = now
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      hasPending = false
      callback(newValue)
    }
    else {
      latestValue = newValue
      hasPending = true

      if (timeoutId === null) {
        timeoutId = setTimeout(() => {
          lastExec = Date.now()
          timeoutId = null
          if (hasPending) {
            hasPending = false
            callback(latestValue as T)
          }
        }, interval - elapsed)
      }
    }
  })

  return () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    hasPending = false
    unwatch()
  }
}
