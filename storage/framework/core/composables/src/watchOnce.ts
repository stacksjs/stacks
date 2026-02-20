import type { Ref } from '@stacksjs/stx'
import { watch } from '@stacksjs/stx'

/**
 * Watch a source and automatically stop after the first change.
 *
 * @param source - The reactive source to watch
 * @param callback - The callback to invoke on the first change
 * @returns A manual stop function (in case you want to stop before first trigger)
 *
 * @example
 * ```ts
 * const count = ref(0)
 * watchOnce(count, (value) => {
 *   console.log('First change:', value)
 * })
 * count.value = 1 // callback fires
 * count.value = 2 // callback does NOT fire
 * ```
 */
export function watchOnce<T>(source: Ref<T>, callback: (value: T) => void): () => void {
  let stopped = false

  const unwatch = watch(source, (newValue) => {
    if (stopped) return
    stopped = true
    unwatch()
    callback(newValue)
  })

  return () => {
    if (!stopped) {
      stopped = true
      unwatch()
    }
  }
}
