import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

/**
 * Reactive online status.
 * Tracks navigator.onLine and listens for online/offline events.
 * In non-browser environments, defaults to true.
 */
export function useOnline(): Ref<boolean> {
  const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)

  if (typeof window !== 'undefined') {
    const onOnline = () => { isOnline.value = true }
    const onOffline = () => { isOnline.value = false }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    try {
      onUnmounted(() => {
        window.removeEventListener('online', onOnline)
        window.removeEventListener('offline', onOffline)
      })
    }
    catch {
      // Not in a component context
    }
  }

  return isOnline
}
