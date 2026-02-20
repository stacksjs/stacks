import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

export interface UseVibrateOptions {
  /** Vibration pattern in milliseconds */
  pattern?: number | number[]
}

export interface UseVibrateReturn {
  isSupported: Ref<boolean>
  vibrate: (pattern?: number | number[]) => boolean
  stop: () => void
}

/**
 * Reactive Vibration API.
 */
export function useVibrate(options: UseVibrateOptions = {}): UseVibrateReturn {
  const { pattern = 200 } = options
  const isSupported = ref(typeof navigator !== 'undefined' && 'vibrate' in navigator)

  function vibrate(p?: number | number[]): boolean {
    if (!isSupported.value) return false
    return navigator.vibrate(p ?? pattern)
  }

  function stop(): void {
    if (isSupported.value)
      navigator.vibrate(0)
  }

  return { isSupported, vibrate, stop }
}
