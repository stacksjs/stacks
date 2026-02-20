import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { type MaybeRef, unref, noop } from './_shared'

export interface UseDraggableOptions {
  /** Initial position */
  initialValue?: { x: number, y: number }
  /** Called when drag starts. Return false to prevent dragging. */
  onStart?: (position: { x: number, y: number }, event: PointerEvent) => void | false
  /** Called during drag */
  onMove?: (position: { x: number, y: number }, event: PointerEvent) => void
  /** Called when drag ends */
  onEnd?: (position: { x: number, y: number }, event: PointerEvent) => void
}

export interface UseDraggableReturn {
  x: Ref<number>
  y: Ref<number>
  isDragging: Ref<boolean>
  style: Ref<string>
}

/**
 * Make an element draggable.
 * Handles pointer events to enable drag-and-drop positioning.
 *
 * @param target - The element to make draggable (or a Ref to one)
 * @param options - Configuration for initial position and drag callbacks
 * @returns Reactive x, y position, dragging state, and computed style string
 */
export function useDraggable(
  target: MaybeRef<HTMLElement | null>,
  options?: UseDraggableOptions,
): UseDraggableReturn {
  const initialX = options?.initialValue?.x ?? 0
  const initialY = options?.initialValue?.y ?? 0

  const x = ref(initialX)
  const y = ref(initialY)
  const isDragging = ref(false)
  const style = ref(`left: ${initialX}px; top: ${initialY}px;`)

  let cleanup = noop

  if (typeof window !== 'undefined') {
    const cleanups: Array<() => void> = []
    let startX = 0
    let startY = 0
    let offsetX = 0
    let offsetY = 0

    const updateStyle = (): void => {
      style.value = `left: ${x.value}px; top: ${y.value}px;`
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (!isDragging.value) return

      x.value = event.clientX - offsetX
      y.value = event.clientY - offsetY
      updateStyle()

      if (options?.onMove) {
        options.onMove({ x: x.value, y: y.value }, event)
      }
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (!isDragging.value) return

      isDragging.value = false

      if (options?.onEnd) {
        options.onEnd({ x: x.value, y: y.value }, event)
      }

      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    const onPointerDown = (event: PointerEvent): void => {
      const pos = { x: x.value, y: y.value }

      if (options?.onStart) {
        const result = options.onStart(pos, event)
        if (result === false) return
      }

      startX = event.clientX
      startY = event.clientY
      offsetX = startX - x.value
      offsetY = startY - y.value

      isDragging.value = true

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    }

    const el = unref(target)
    if (el) {
      el.addEventListener('pointerdown', onPointerDown)
      cleanups.push(() => el.removeEventListener('pointerdown', onPointerDown))
    }

    cleanup = () => {
      for (const fn of cleanups) fn()
      cleanups.length = 0
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      cleanup = noop
    }
  }

  try {
    onUnmounted(() => cleanup())
  }
  catch {
    // Not in a component context
  }

  return { x, y, isDragging, style }
}
