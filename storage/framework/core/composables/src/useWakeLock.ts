import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export interface UseWakeLockReturn {
  isSupported: Ref<boolean>
  isActive: Ref<boolean>
  request: () => Promise<void>
  release: () => Promise<void>
}

/**
 * Reactive Screen Wake Lock API.
 * Prevents the screen from dimming/locking.
 */
export function useWakeLock(): UseWakeLockReturn {
  const isSupported = ref(typeof navigator !== 'undefined' && 'wakeLock' in navigator)
  const isActive = ref(false)
  let sentinel: WakeLockSentinel | null = null

  async function request(): Promise<void> {
    if (!isSupported.value) return
    try {
      sentinel = await navigator.wakeLock.request('screen')
      isActive.value = true
      sentinel.addEventListener('release', () => {
        isActive.value = false
        sentinel = null
      })
    }
    catch {
      isActive.value = false
    }
  }

  async function release(): Promise<void> {
    if (sentinel) {
      await sentinel.release()
      sentinel = null
      isActive.value = false
    }
  }

  try {
    onUnmounted(() => {
      release()
    })
  }
  catch {
    // Not in a component context
  }

  return { isSupported, isActive, request, release }
}
