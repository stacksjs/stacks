import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

export interface UseParallaxReturn {
  /** Horizontal tilt from -0.5 to 0.5 */
  tilt: Ref<number>
  /** Vertical roll from -0.5 to 0.5 */
  roll: Ref<number>
  /** Source type */
  source: Ref<'mouse' | 'deviceOrientation'>
}

export interface UseParallaxOptions {
  deviceOrientationTiltAdjust?: (value: number) => number
  deviceOrientationRollAdjust?: (value: number) => number
}

/**
 * Reactive parallax effect based on mouse position or device orientation.
 */
export function useParallax(
  target: MaybeRef<HTMLElement | null | undefined>,
  options: UseParallaxOptions = {},
): UseParallaxReturn {
  const tilt = ref(0)
  const roll = ref(0)
  const source = ref<'mouse' | 'deviceOrientation'>('mouse') as Ref<'mouse' | 'deviceOrientation'>

  if (typeof window === 'undefined')
    return { tilt, roll, source }

  const mouseHandler = (e: MouseEvent): void => {
    const el = unref(target) as HTMLElement | null
    if (!el) return

    const rect = el.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    tilt.value = (e.clientX - centerX) / (rect.width / 2) * 0.5
    roll.value = (e.clientY - centerY) / (rect.height / 2) * 0.5
    source.value = 'mouse'
  }

  window.addEventListener('mousemove', mouseHandler, { passive: true })

  // Device orientation fallback
  const orientationHandler = (e: DeviceOrientationEvent): void => {
    if (e.gamma !== null && e.beta !== null) {
      const tiltVal = e.gamma / 90 // -1 to 1
      const rollVal = (e.beta - 45) / 90 // adjust for holding
      tilt.value = options.deviceOrientationTiltAdjust?.(tiltVal) ?? tiltVal * 0.5
      roll.value = options.deviceOrientationRollAdjust?.(rollVal) ?? rollVal * 0.5
      source.value = 'deviceOrientation'
    }
  }

  window.addEventListener('deviceorientation', orientationHandler, { passive: true })

  try {
    onUnmounted(() => {
      window.removeEventListener('mousemove', mouseHandler)
      window.removeEventListener('deviceorientation', orientationHandler)
    })
  }
  catch {
    // Not in a component context
  }

  return { tilt, roll, source }
}
