import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { isRef, unref } from './_shared'

/**
 * Debounce a value. Returns a ref that only updates after the source
 * has stopped changing for the given delay.
 *
 * @param value - The source value or ref
 * @param ms - Debounce delay in milliseconds. Default: 200
 */
export function useDebounce<T>(value: MaybeRef<T>, ms: number = 200): Ref<T> {
  const debounced = ref(unref(value)) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | null = null

  if (isRef(value)) {
    watch(value as Ref<T>, (newVal) => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        debounced.value = newVal
        timer = null
      }, ms)
    })
  }

  return debounced
}
