import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

export interface UseMousePressedReturn {
  pressed: Ref<boolean>
  sourceType: Ref<'mouse' | 'touch' | null>
}

/**
 * Reactive mouse/touch pressed state.
 */
export function useMousePressed(target?: MaybeRef<HTMLElement | Window | null | undefined>): UseMousePressedReturn {
  const pressed = ref(false)
  const sourceType = ref<'mouse' | 'touch' | null>(null) as Ref<'mouse' | 'touch' | null>

  if (typeof window === 'undefined')
    return { pressed, sourceType }

  const el = (unref(target) ?? window) as EventTarget

  const onMouseDown = (): void => {
    pressed.value = true
    sourceType.value = 'mouse'
  }

  const onTouchStart = (): void => {
    pressed.value = true
    sourceType.value = 'touch'
  }

  const onUp = (): void => {
    pressed.value = false
  }

  el.addEventListener('mousedown', onMouseDown, { passive: true })
  el.addEventListener('touchstart', onTouchStart, { passive: true })
  window.addEventListener('mouseup', onUp, { passive: true })
  window.addEventListener('touchend', onUp, { passive: true })
  window.addEventListener('touchcancel', onUp, { passive: true })

  try {
    onUnmounted(() => {
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
      window.removeEventListener('touchcancel', onUp)
    })
  }
  catch {
    // Not in a component context
  }

  return { pressed, sourceType }
}
