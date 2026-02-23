import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

type ScreenOrientationLockType = 'any' | 'natural' | 'landscape' | 'portrait' | 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary'

export interface UseScreenOrientationReturn {
  isSupported: Ref<boolean>
  orientation: Ref<string | undefined>
  angle: Ref<number>
  lockOrientation: (type: ScreenOrientationLockType) => Promise<void>
  unlockOrientation: () => void
}

/**
 * Reactive Screen Orientation API.
 */
export function useScreenOrientation(): UseScreenOrientationReturn {
  const isSupported = ref(typeof screen !== 'undefined' && 'orientation' in screen)
  const orientation = ref<string | undefined>(undefined)
  const angle = ref(0)

  if (isSupported.value) {
    orientation.value = screen.orientation.type
    angle.value = screen.orientation.angle

    const handler = (): void => {
      orientation.value = screen.orientation.type
      angle.value = screen.orientation.angle
    }

    screen.orientation.addEventListener('change', handler)

    try {
      onUnmounted(() => {
        screen.orientation.removeEventListener('change', handler)
      })
    }
    catch {
      // Not in a component context
    }
  }

  async function lockOrientation(type: ScreenOrientationLockType): Promise<void> {
    if (isSupported.value) {
      const orient = screen.orientation as ScreenOrientation & { lock: (type: string) => Promise<void> }
      await orient.lock(type)
    }
  }

  function unlockOrientation(): void {
    if (isSupported.value)
      screen.orientation.unlock()
  }

  return { isSupported, orientation, angle, lockOrientation, unlockOrientation }
}
