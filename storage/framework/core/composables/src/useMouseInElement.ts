import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

export interface UseMouseInElementReturn {
  x: Ref<number>
  y: Ref<number>
  elementX: Ref<number>
  elementY: Ref<number>
  elementPositionX: Ref<number>
  elementPositionY: Ref<number>
  elementHeight: Ref<number>
  elementWidth: Ref<number>
  isOutside: Ref<boolean>
}

/**
 * Reactive mouse position relative to an element.
 */
export function useMouseInElement(target: MaybeRef<HTMLElement | null | undefined>): UseMouseInElementReturn {
  const x = ref(0)
  const y = ref(0)
  const elementX = ref(0)
  const elementY = ref(0)
  const elementPositionX = ref(0)
  const elementPositionY = ref(0)
  const elementHeight = ref(0)
  const elementWidth = ref(0)
  const isOutside = ref(true)

  if (typeof window === 'undefined')
    return { x, y, elementX, elementY, elementPositionX, elementPositionY, elementHeight, elementWidth, isOutside }

  const handler = (event: MouseEvent): void => {
    x.value = event.pageX
    y.value = event.pageY

    const el = unref(target) as HTMLElement | null | undefined
    if (!el) {
      isOutside.value = true
      return
    }

    const rect = el.getBoundingClientRect()
    elementPositionX.value = rect.left + window.scrollX
    elementPositionY.value = rect.top + window.scrollY
    elementHeight.value = rect.height
    elementWidth.value = rect.width

    elementX.value = event.pageX - elementPositionX.value
    elementY.value = event.pageY - elementPositionY.value

    isOutside.value = elementX.value < 0
      || elementY.value < 0
      || elementX.value > elementWidth.value
      || elementY.value > elementHeight.value
  }

  window.addEventListener('mousemove', handler, { passive: true })

  try {
    onUnmounted(() => {
      window.removeEventListener('mousemove', handler)
    })
  }
  catch {
    // Not in a component context
  }

  return { x, y, elementX, elementY, elementPositionX, elementPositionY, elementHeight, elementWidth, isOutside }
}
