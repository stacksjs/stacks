import type { Ref } from '@stacksjs/stx'
import { watch } from '@stacksjs/stx'

export type EventFilter = (invoke: () => void) => void

/**
 * Watch a source with a custom event filter.
 * The filter receives the invoke function and decides when to call it.
 */
export function watchWithFilter<T>(
  source: Ref<T>,
  callback: (value: T) => void,
  eventFilter: EventFilter,
): () => void {
  const unwatch = watch(source, (newValue) => {
    eventFilter(() => callback(newValue))
  })

  return unwatch
}
