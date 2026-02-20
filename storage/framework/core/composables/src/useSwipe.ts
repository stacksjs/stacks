import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

export type SwipeDirection = 'up' | 'down' | 'left' | 'right' | 'none'

export interface UseSwipeOptions {
  /** Minimum distance in pixels to count as a swipe. Default: 50 */
  threshold?: number
  /** Callback when swipe is detected */
  onSwipe?: (direction: SwipeDirection) => void
  /** Callback during swipe movement */
  onSwipeStart?: (e: TouchEvent) => void
  /** Callback when swipe ends */
  onSwipeEnd?: (e: TouchEvent, direction: SwipeDirection) => void
  /** Use passive listeners. Default: true */
  passive?: boolean
}

export interface UseSwipeReturn {
  isSwiping: Ref<boolean>
  direction: Ref<SwipeDirection>
  lengthX: Ref<number>
  lengthY: Ref<number>
}

/**
 * Reactive swipe detection.
 */
export function useSwipe(
  target: MaybeRef<HTMLElement | Window | null | undefined>,
  options: UseSwipeOptions = {},
): UseSwipeReturn {
  const { threshold = 50, onSwipe, onSwipeStart, onSwipeEnd, passive = true } = options

  const isSwiping = ref(false)
  const direction = ref<SwipeDirection>('none') as Ref<SwipeDirection>
  const lengthX = ref(0)
  const lengthY = ref(0)

  let startX = 0
  let startY = 0

  if (typeof window === 'undefined')
    return { isSwiping, direction, lengthX, lengthY }

  const el = (unref(target) ?? window) as EventTarget

  const onTouchStart = (e: Event): void => {
    const touch = (e as TouchEvent).touches[0]
    startX = touch.clientX
    startY = touch.clientY
    isSwiping.value = true
    direction.value = 'none'
    lengthX.value = 0
    lengthY.value = 0
    onSwipeStart?.(e as TouchEvent)
  }

  const onTouchMove = (e: Event): void => {
    if (!isSwiping.value) return
    const touch = (e as TouchEvent).touches[0]
    lengthX.value = touch.clientX - startX
    lengthY.value = touch.clientY - startY

    const absX = Math.abs(lengthX.value)
    const absY = Math.abs(lengthY.value)

    if (absX > absY)
      direction.value = lengthX.value > 0 ? 'right' : 'left'
    else if (absY > absX)
      direction.value = lengthY.value > 0 ? 'down' : 'up'
  }

  const onTouchEnd = (e: Event): void => {
    if (!isSwiping.value) return
    isSwiping.value = false

    const absX = Math.abs(lengthX.value)
    const absY = Math.abs(lengthY.value)
    const maxLength = Math.max(absX, absY)

    if (maxLength >= threshold) {
      onSwipe?.(direction.value)
      onSwipeEnd?.(e as TouchEvent, direction.value)
    }
    else {
      direction.value = 'none'
      onSwipeEnd?.(e as TouchEvent, 'none')
    }
  }

  el.addEventListener('touchstart', onTouchStart, { passive })
  el.addEventListener('touchmove', onTouchMove, { passive })
  el.addEventListener('touchend', onTouchEnd, { passive })
  el.addEventListener('touchcancel', onTouchEnd, { passive })

  try {
    onUnmounted(() => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    })
  }
  catch {
    // Not in a component context
  }

  return { isSwiping, direction, lengthX, lengthY }
}
