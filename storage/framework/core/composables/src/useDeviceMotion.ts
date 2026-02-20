import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { noop } from './_shared'

export interface UseDeviceMotionReturn {
  acceleration: {
    x: Ref<number | null>
    y: Ref<number | null>
    z: Ref<number | null>
  }
  accelerationIncludingGravity: {
    x: Ref<number | null>
    y: Ref<number | null>
    z: Ref<number | null>
  }
  rotationRate: {
    alpha: Ref<number | null>
    beta: Ref<number | null>
    gamma: Ref<number | null>
  }
  interval: Ref<number>
  isSupported: Ref<boolean>
}

/**
 * Reactive device motion.
 * Tracks device acceleration and rotation using the DeviceMotionEvent API.
 *
 * @returns Reactive acceleration, accelerationIncludingGravity, rotationRate, and interval
 */
export function useDeviceMotion(): UseDeviceMotionReturn {
  const isSupported = ref(typeof window !== 'undefined' && 'DeviceMotionEvent' in window)

  const acceleration = {
    x: ref<number | null>(null),
    y: ref<number | null>(null),
    z: ref<number | null>(null),
  }

  const accelerationIncludingGravity = {
    x: ref<number | null>(null),
    y: ref<number | null>(null),
    z: ref<number | null>(null),
  }

  const rotationRate = {
    alpha: ref<number | null>(null),
    beta: ref<number | null>(null),
    gamma: ref<number | null>(null),
  }

  const interval = ref(0)

  let cleanup = noop

  if (typeof window !== 'undefined' && isSupported.value) {
    const handler = (event: DeviceMotionEvent): void => {
      if (event.acceleration) {
        acceleration.x.value = event.acceleration.x
        acceleration.y.value = event.acceleration.y
        acceleration.z.value = event.acceleration.z
      }

      if (event.accelerationIncludingGravity) {
        accelerationIncludingGravity.x.value = event.accelerationIncludingGravity.x
        accelerationIncludingGravity.y.value = event.accelerationIncludingGravity.y
        accelerationIncludingGravity.z.value = event.accelerationIncludingGravity.z
      }

      if (event.rotationRate) {
        rotationRate.alpha.value = event.rotationRate.alpha
        rotationRate.beta.value = event.rotationRate.beta
        rotationRate.gamma.value = event.rotationRate.gamma
      }

      interval.value = event.interval
    }

    window.addEventListener('devicemotion', handler as EventListener, { passive: true })
    cleanup = () => {
      window.removeEventListener('devicemotion', handler as EventListener)
      cleanup = noop
    }
  }

  try {
    onUnmounted(() => cleanup())
  }
  catch {
    // Not in a component context
  }

  return {
    acceleration,
    accelerationIncludingGravity,
    rotationRate,
    interval,
    isSupported,
  }
}
