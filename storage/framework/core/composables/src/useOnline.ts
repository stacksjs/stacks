import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

/**
 * Reactive online status.
 * Tracks navigator.onLine and listens for online/offline events.
 * In non-browser environments, defaults to true.
 */
export function useOnline(): Ref<boolean> {
  const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      isOnline.value = true
    })
    window.addEventListener('offline', () => {
      isOnline.value = false
    })
  }

  return isOnline
}
