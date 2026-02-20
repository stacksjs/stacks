import type { Ref } from '@stacksjs/stx'
import { watch } from '@stacksjs/stx'

/**
 * Watch a source with deep comparison by serializing to JSON.
 * Since stx watch is shallow, this provides deep-watch behavior by
 * comparing JSON serializations.
 */
export function watchDeep<T>(
  source: Ref<T>,
  callback: (value: T) => void,
  options?: { immediate?: boolean },
): () => void {
  let prev = JSON.stringify(source.value)

  if (options?.immediate)
    callback(source.value)

  const unwatch = watch(source, (newValue) => {
    const next = JSON.stringify(newValue)
    if (next !== prev) {
      prev = next
      callback(newValue)
    }
  })

  return unwatch
}
