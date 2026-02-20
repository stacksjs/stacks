import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

/**
 * Watch a source, but only trigger the callback at most `count` times.
 */
export function watchAtMost<T>(
  source: Ref<T>,
  callback: (value: T) => void,
  count: number,
): { stop: () => void, remaining: Ref<number> } {
  const remaining = ref(count)

  const unwatch = watch(source, (newValue) => {
    if (remaining.value > 0) {
      remaining.value--
      callback(newValue)
      if (remaining.value <= 0)
        unwatch()
    }
  })

  return { stop: unwatch, remaining }
}
