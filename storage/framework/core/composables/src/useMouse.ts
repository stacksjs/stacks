import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { noop } from './_shared'

export interface UseMouseOptions {
  /** Type of coordinates to track: 'page', 'client', or 'screen'. Default: 'page' */
  type?: 'page' | 'client' | 'screen'
  /** Whether to track touch events. Default: true */
  touch?: boolean
  /** Initial position values */
  initialValue?: { x: number, y: number }
}

export interface UseMouseReturn {
  x: Ref<number>
  y: Ref<number>
  sourceType: Ref<'mouse' | 'touch' | null>
}

/**
 * Reactive mouse position.
 * Tracks the mouse (and optionally touch) position on the page.
 *
 * @param options - Configuration for coordinate type, touch tracking, and initial values
 * @returns Reactive x, y coordinates and source type
 */
export function useMouse(options?: UseMouseOptions): UseMouseReturn {
  const type = options?.type ?? 'page'
  const touch = options?.touch ?? true
  const initialValue = options?.initialValue ?? { x: 0, y: 0 }

  const x = ref(initialValue.x)
  const y = ref(initialValue.y)
  const sourceType = ref<'mouse' | 'touch' | null>(null)

  let cleanup = noop

  if (typeof window !== 'undefined') {
    const cleanups: Array<() => void> = []

    const getMouseCoords = (event: MouseEvent): { x: number, y: number } => {
      switch (type) {
        case 'page':
          return { x: event.pageX, y: event.pageY }
        case 'client':
          return { x: event.clientX, y: event.clientY }
        case 'screen':
          return { x: event.screenX, y: event.screenY }
        default:
          return { x: event.pageX, y: event.pageY }
      }
    }

    const mouseHandler = (event: MouseEvent): void => {
      const coords = getMouseCoords(event)
      x.value = coords.x
      y.value = coords.y
      sourceType.value = 'mouse'
    }

    window.addEventListener('mousemove', mouseHandler, { passive: true })
    cleanups.push(() => window.removeEventListener('mousemove', mouseHandler))

    if (touch) {
      const touchHandler = (event: TouchEvent): void => {
        if (event.touches.length > 0) {
          const touchEvent = event.touches[0]
          switch (type) {
            case 'page':
              x.value = touchEvent.pageX
              y.value = touchEvent.pageY
              break
            case 'client':
              x.value = touchEvent.clientX
              y.value = touchEvent.clientY
              break
            case 'screen':
              x.value = touchEvent.screenX
              y.value = touchEvent.screenY
              break
          }
          sourceType.value = 'touch'
        }
      }

      window.addEventListener('touchstart', touchHandler, { passive: true })
      window.addEventListener('touchmove', touchHandler, { passive: true })
      cleanups.push(() => {
        window.removeEventListener('touchstart', touchHandler)
        window.removeEventListener('touchmove', touchHandler)
      })
    }

    cleanup = () => {
      for (const fn of cleanups) fn()
      cleanups.length = 0
      cleanup = noop
    }
  }

  try {
    onUnmounted(() => cleanup())
  }
  catch {
    // Not in a component context
  }

  return { x, y, sourceType }
}
