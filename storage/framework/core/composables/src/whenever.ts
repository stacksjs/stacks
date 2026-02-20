import type { Ref } from '@stacksjs/stx'
import { watch } from '@stacksjs/stx'

/**
 * Watch a source and call callback only when the value becomes truthy.
 *
 * @param source - The reactive source to watch
 * @param callback - The callback to invoke when the source value is truthy
 * @returns An unsubscribe function that stops watching
 *
 * @example
 * ```ts
 * const isReady = ref(false)
 * whenever(isReady, (value) => {
 *   console.log('Ready!', value)
 * })
 * isReady.value = true // callback fires
 * ```
 */
export function whenever<T>(source: Ref<T>, callback: (value: T) => void): () => void {
  const unwatch = watch(source, (newValue) => {
    if (newValue) {
      callback(newValue)
    }
  })

  return unwatch
}
