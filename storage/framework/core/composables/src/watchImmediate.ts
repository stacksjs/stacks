import type { Ref } from '@stacksjs/stx'
import { watch } from '@stacksjs/stx'

/**
 * Watch a source and call the callback immediately with the current value, then on changes.
 */
export function watchImmediate<T>(
  source: Ref<T>,
  callback: (value: T) => void,
): () => void {
  // Call immediately
  callback(source.value)

  // Then watch for changes
  return watch(source, (newValue) => {
    callback(newValue)
  })
}
