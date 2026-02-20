import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

export interface WatchIgnorableReturn {
  stop: () => void
  ignoreUpdates: (updater: () => void) => void
  isIgnoring: Ref<boolean>
}

/**
 * A watch that can temporarily ignore updates.
 */
export function watchIgnorable<T>(
  source: Ref<T>,
  callback: (value: T, oldValue: T | undefined) => void,
): WatchIgnorableReturn {
  const isIgnoring = ref(false)
  let lastValue: T | undefined

  const unwatch = watch(source, (newValue) => {
    if (!isIgnoring.value)
      callback(newValue, lastValue)
    lastValue = newValue
  })

  function ignoreUpdates(updater: () => void): void {
    isIgnoring.value = true
    updater()
    // Use microtask to reset after the watch has been triggered
    Promise.resolve().then(() => {
      isIgnoring.value = false
    })
  }

  return { stop: unwatch, ignoreUpdates, isIgnoring }
}

/** Alias for watchIgnorable */
export const ignorableWatch = watchIgnorable
