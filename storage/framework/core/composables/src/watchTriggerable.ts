import type { Ref } from '@stacksjs/stx'
import { watch } from '@stacksjs/stx'

/**
 * A watch that can also be manually triggered.
 */
export function watchTriggerable<T>(
  source: Ref<T>,
  callback: (value: T) => void,
): { stop: () => void, trigger: () => void } {
  const unwatch = watch(source, (newValue) => {
    callback(newValue)
  })

  function trigger(): void {
    callback(source.value)
  }

  return { stop: unwatch, trigger }
}
