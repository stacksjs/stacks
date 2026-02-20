import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'
import type { SwipeDirection } from './useSwipe'

export interface UsePointerSwipeOptions {
  threshold?: number
  onSwipe?: (direction: SwipeDirection) => void
  onSwipeEnd?: (e: PointerEvent, direction: SwipeDirection) => void
}

export interface UsePointerSwipeReturn {
  isSwiping: Ref<boolean>
  direction: Ref<SwipeDirection>
  distanceX: Ref<number>
  distanceY: Ref<number>
  posStart: Ref<{ x: number, y: number }>
  posEnd: Ref<{ x: number, y: number }>
}

/**
 * Reactive pointer-based swipe detection.
 */
export function usePointerSwipe(
  target: MaybeRef<HTMLElement | null | undefined>,
  options: UsePointerSwipeOptions = {},
): UsePointerSwipeReturn {
  const { threshold = 50, onSwipe, onSwipeEnd } = options

  const isSwiping = ref(false)
  const direction = ref<SwipeDirection>('none') as Ref<SwipeDirection>
  const distanceX = ref(0)
  const distanceY = ref(0)
  const posStart = ref({ x: 0, y: 0 })
  const posEnd = ref({ x: 0, y: 0 })

  if (typeof window === 'undefined')
    return { isSwiping, direction, distanceX, distanceY, posStart, posEnd }

  const el = unref(target) as HTMLElement | null
  if (!el)
    return { isSwiping, direction, distanceX, distanceY, posStart, posEnd }

  const onPointerDown = (e: PointerEvent): void => {
    isSwiping.value = true
    direction.value = 'none'
    posStart.value = { x: e.clientX, y: e.clientY }
    posEnd.value = { x: e.clientX, y: e.clientY }
    distanceX.value = 0
    distanceY.value = 0
    el.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent): void => {
    if (!isSwiping.value) return
    posEnd.value = { x: e.clientX, y: e.clientY }
    distanceX.value = posEnd.value.x - posStart.value.x
    distanceY.value = posEnd.value.y - posStart.value.y

    const absX = Math.abs(distanceX.value)
    const absY = Math.abs(distanceY.value)

    if (absX > absY)
      direction.value = distanceX.value > 0 ? 'right' : 'left'
    else if (absY > absX)
      direction.value = distanceY.value > 0 ? 'down' : 'up'
  }

  const onPointerUp = (e: PointerEvent): void => {
    if (!isSwiping.value) return
    isSwiping.value = false

    const maxDist = Math.max(Math.abs(distanceX.value), Math.abs(distanceY.value))
    if (maxDist >= threshold) {
      onSwipe?.(direction.value)
      onSwipeEnd?.(e, direction.value)
    }
    else {
      direction.value = 'none'
      onSwipeEnd?.(e, 'none')
    }
  }

  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerUp)

  try {
    onUnmounted(() => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
    })
  }
  catch {
    // Not in a component context
  }

  return { isSwiping, direction, distanceX, distanceY, posStart, posEnd }
}
