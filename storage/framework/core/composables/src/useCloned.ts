import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

export interface UseClonedOptions<T> {
  clone?: (val: T) => T
}

export interface UseClonedReturn<T> {
  cloned: Ref<T>
  sync: () => void
}

function defaultClone<T>(val: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(val)
  }
  return JSON.parse(JSON.stringify(val)) as T
}

/**
 * Deep clone a ref value. Returns a cloned ref that syncs when the source changes.
 *
 * @param source - The source ref to clone
 * @param options - Optional custom clone function
 */
export function useCloned<T>(source: Ref<T>, options: UseClonedOptions<T> = {}): UseClonedReturn<T> {
  const cloneFn = options.clone ?? defaultClone

  const cloned = ref<T>(cloneFn(source.value)) as Ref<T>

  function sync(): void {
    cloned.value = cloneFn(source.value)
  }

  watch(source, () => {
    sync()
  })

  return { cloned, sync }
}
