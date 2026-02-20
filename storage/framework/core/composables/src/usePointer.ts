import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export interface UsePointerReturn {
  isInside: Ref<boolean>
  x: Ref<number>
  y: Ref<number>
  pointerId: Ref<number>
  pressure: Ref<number>
  tiltX: Ref<number>
  tiltY: Ref<number>
  pointerType: Ref<string>
}

/**
 * Reactive pointer position and state.
 */
export function usePointer(target?: HTMLElement | Window): UsePointerReturn {
  const x = ref(0)
  const y = ref(0)
  const pointerId = ref(0)
  const pressure = ref(0)
  const tiltX = ref(0)
  const tiltY = ref(0)
  const pointerType = ref('')
  const isInside = ref(false)

  if (typeof window === 'undefined')
    return { isInside, x, y, pointerId, pressure, tiltX, tiltY, pointerType }

  const el = target ?? window

  const handler = (e: PointerEvent): void => {
    x.value = e.pageX
    y.value = e.pageY
    pointerId.value = e.pointerId
    pressure.value = e.pressure
    tiltX.value = e.tiltX
    tiltY.value = e.tiltY
    pointerType.value = e.pointerType
  }

  const onEnter = (): void => { isInside.value = true }
  const onLeave = (): void => { isInside.value = false }

  el.addEventListener('pointermove', handler as EventListener, { passive: true })
  el.addEventListener('pointerdown', handler as EventListener, { passive: true })
  el.addEventListener('pointerenter', onEnter as EventListener, { passive: true })
  el.addEventListener('pointerleave', onLeave as EventListener, { passive: true })

  try {
    onUnmounted(() => {
      el.removeEventListener('pointermove', handler as EventListener)
      el.removeEventListener('pointerdown', handler as EventListener)
      el.removeEventListener('pointerenter', onEnter as EventListener)
      el.removeEventListener('pointerleave', onLeave as EventListener)
    })
  }
  catch {
    // Not in a component context
  }

  return { isInside, x, y, pointerId, pressure, tiltX, tiltY, pointerType }
}
