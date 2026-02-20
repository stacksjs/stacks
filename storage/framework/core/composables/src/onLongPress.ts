import { onUnmounted } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

export interface OnLongPressOptions {
  /** Delay in milliseconds before the long press is triggered. Default: 500 */
  delay?: number
  /** Distance threshold to cancel the press (px). Default: 10 */
  distanceThreshold?: number
}

/**
 * Listen for long press events on an element.
 *
 * @param target - The target element
 * @param handler - The callback to invoke on long press
 * @param options - Configuration options
 * @returns A cleanup function
 */
export function onLongPress(
  target: MaybeRef<HTMLElement | null | undefined>,
  handler: (e: PointerEvent) => void,
  options: OnLongPressOptions = {},
): () => void {
  const { delay = 500, distanceThreshold = 10 } = options
  let timer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0

  const el = unref(target) as HTMLElement | null
  if (!el) return () => {}

  const clear = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const onDown = (e: PointerEvent): void => {
    startX = e.clientX
    startY = e.clientY
    clear()
    timer = setTimeout(() => handler(e), delay)
  }

  const onMove = (e: PointerEvent): void => {
    if (timer === null) return
    const dx = Math.abs(e.clientX - startX)
    const dy = Math.abs(e.clientY - startY)
    if (dx > distanceThreshold || dy > distanceThreshold)
      clear()
  }

  const onUp = (): void => {
    clear()
  }

  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)

  const cleanup = (): void => {
    clear()
    el.removeEventListener('pointerdown', onDown)
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointercancel', onUp)
  }

  try {
    onUnmounted(cleanup)
  }
  catch {
    // Not in a component context
  }

  return cleanup
}
