import type { Ref } from '@stacksjs/stx'
import { watch } from '@stacksjs/stx'

export interface WatchDebouncedOptions {
  /**
   * Debounce delay in milliseconds.
   * @default 200
   */
  debounce?: number
}

/**
 * Watch a source with debounced callback invocation.
 * The callback is only called after the source value has stopped changing
 * for the specified debounce duration.
 *
 * @param source - The reactive source to watch
 * @param callback - The callback to invoke (debounced)
 * @param options - Configuration options
 * @returns A stop function that cleans up both the watch and any pending timer
 *
 * @example
 * ```ts
 * const search = ref('')
 * watchDebounced(search, (value) => {
 *   fetchResults(value)
 * }, { debounce: 300 })
 * ```
 */
export function watchDebounced<T>(
  source: Ref<T>,
  callback: (value: T) => void,
  options?: WatchDebouncedOptions,
): () => void {
  const delay = options?.debounce ?? 200
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const unwatch = watch(source, (newValue) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      timeoutId = null
      callback(newValue)
    }, delay)
  })

  return () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    unwatch()
  }
}
