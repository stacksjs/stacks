import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

export interface UseLastChangedOptions {
  initialValue?: number | null
}

/**
 * Track the timestamp of when a ref last changed.
 *
 * @param source - The reactive source to watch
 * @param options - Optional initial timestamp value
 */
export function useLastChanged(source: Ref<any>, options: UseLastChangedOptions = {}): Ref<number | null> {
  const { initialValue = null } = options
  const lastChanged = ref<number | null>(initialValue) as Ref<number | null>

  watch(source, () => {
    lastChanged.value = Date.now()
  })

  return lastChanged
}
