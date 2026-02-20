import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export interface UseScreenOrientationReturn {
  isSupported: Ref<boolean>
  orientation: Ref<OrientationType | undefined>
  angle: Ref<number>
  lockOrientation: (type: OrientationLockType) => Promise<void>
  unlockOrientation: () => void
}

/**
 * Reactive Screen Orientation API.
 */
export function useScreenOrientation(): UseScreenOrientationReturn {
  const isSupported = ref(typeof screen !== 'undefined' && 'orientation' in screen)
  const orientation = ref<OrientationType | undefined>(undefined)
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

  async function lockOrientation(type: OrientationLockType): Promise<void> {
    if (isSupported.value)
      await screen.orientation.lock(type)
  }

  function unlockOrientation(): void {
    if (isSupported.value)
      screen.orientation.unlock()
  }

  return { isSupported, orientation, angle, lockOrientation, unlockOrientation }
}
