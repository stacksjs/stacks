import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

/**
 * Check if a browser feature is supported.
 *
 * @param callback - A function that returns true if the feature is supported
 * @returns A reactive ref indicating support status
 */
export function useSupported(callback: () => boolean): Ref<boolean> {
  const isSupported = ref(false)

  try {
    isSupported.value = callback()
  }
  catch {
    isSupported.value = false
  }

  return isSupported
}
