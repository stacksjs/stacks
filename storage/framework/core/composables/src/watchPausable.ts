import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

export interface WatchPausableReturn {
  stop: () => void
  pause: () => void
  resume: () => void
  isActive: Ref<boolean>
}

/**
 * A pausable watch.
 */
export function watchPausable<T>(
  source: Ref<T>,
  callback: (value: T, oldValue: T | undefined) => void,
): WatchPausableReturn {
  const isActive = ref(true)
  let lastValue: T | undefined

  const unwatch = watch(source, (newValue) => {
    if (isActive.value) {
      callback(newValue, lastValue)
    }
    lastValue = newValue
  })

  function pause(): void {
    isActive.value = false
  }

  function resume(): void {
    isActive.value = true
  }

  return {
    stop: unwatch,
    pause,
    resume,
    isActive,
  }
}

/** Alias for watchPausable */
export const pausableWatch = watchPausable
