import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export interface UseElementByPointReturn {
  element: Ref<Element | null>
  x: Ref<number>
  y: Ref<number>
}

/**
 * Reactive element at a given point. Tracks the element under the mouse cursor.
 */
export function useElementByPoint(options?: { x?: Ref<number>, y?: Ref<number> }): UseElementByPointReturn {
  const x = options?.x ?? ref(0)
  const y = options?.y ?? ref(0)
  const element = ref<Element | null>(null) as Ref<Element | null>

  if (typeof document === 'undefined')
    return { element, x, y }

  const handler = (e: MouseEvent): void => {
    x.value = e.clientX
    y.value = e.clientY
    element.value = document.elementFromPoint(e.clientX, e.clientY)
  }

  document.addEventListener('mousemove', handler, { passive: true })

  try {
    onUnmounted(() => {
      document.removeEventListener('mousemove', handler)
    })
  }
  catch {
    // Not in a component context
  }

  return { element, x, y }
}
