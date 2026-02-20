import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { noop } from './_shared'

export interface UseDeviceOrientationReturn {
  alpha: Ref<number | null>
  beta: Ref<number | null>
  gamma: Ref<number | null>
  absolute: Ref<boolean>
  isSupported: Ref<boolean>
}

/**
 * Reactive device orientation.
 * Tracks device orientation using the DeviceOrientationEvent API.
 *
 * @returns Reactive alpha, beta, gamma angles, absolute flag, and support status
 */
export function useDeviceOrientation(): UseDeviceOrientationReturn {
  const isSupported = ref(typeof window !== 'undefined' && 'DeviceOrientationEvent' in window)

  const alpha = ref<number | null>(null)
  const beta = ref<number | null>(null)
  const gamma = ref<number | null>(null)
  const absolute = ref(false)

  let cleanup = noop

  if (typeof window !== 'undefined' && isSupported.value) {
    const handler = (event: DeviceOrientationEvent): void => {
      alpha.value = event.alpha
      beta.value = event.beta
      gamma.value = event.gamma
      absolute.value = event.absolute
    }

    window.addEventListener('deviceorientation', handler as EventListener, { passive: true })
    cleanup = () => {
      window.removeEventListener('deviceorientation', handler as EventListener)
      cleanup = noop
    }
  }

  try {
    onUnmounted(() => cleanup())
  }
  catch {
    // Not in a component context
  }

  return { alpha, beta, gamma, absolute, isSupported }
}
