import type { Ref } from '@stacksjs/stx'
import { watch } from '@stacksjs/stx'

/**
 * Watch an array ref and provide added/removed items in the callback.
 */
export function watchArray<T>(
  source: Ref<T[]>,
  callback: (newList: T[], oldList: T[], added: T[], removed: T[]) => void,
): () => void {
  let oldList = [...source.value]

  const unwatch = watch(source, (newValue) => {
    const newList = [...newValue]
    const added = newList.filter(item => !oldList.includes(item))
    const removed = oldList.filter(item => !newList.includes(item))
    callback(newList, oldList, added, removed)
    oldList = newList
  })

  return unwatch
}
