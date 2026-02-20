import type { Ref } from '@stacksjs/stx'
import { computed } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

/**
 * Reactive sorted array. Returns a computed ref containing a sorted copy
 * of the source array.
 *
 * @param source - Source array (raw or ref)
 * @param compareFn - Optional comparison function (defaults to natural order)
 */
export function useSorted<T>(source: MaybeRef<T[]>, compareFn?: (a: T, b: T) => number): Ref<T[]> {
  return computed<T[]>(() => {
    const arr = [...unref(source)]
    if (compareFn) {
      return arr.sort(compareFn)
    }
    return arr.sort()
  })
}
