/**
 * The touch behaviour of iOS controls, for the Native components: a long
 * press, scrubbing across a segmented control, a pressable's feedback.
 *
 * Kept here, not in the components, because it reads touch coordinates and
 * element rectangles, which an STX template must not reach for, and because
 * the arithmetic is worth testing on its own.
 */
import { nativeFunctionNow } from './bridge'

export interface LongPressOptions {
  /** How long a finger has to stay down. iOS uses 500ms for a context menu. */
  delay?: number
  /** How far it may drift, in CSS pixels, before it is a scroll instead. */
  tolerance?: number
  /** The press began: the moment to shrink the element and wake the haptics. */
  onPressStart?: () => void
  /** The press ended without becoming a long press. */
  onPressEnd?: () => void
  onLongPress: (event: { x: number, y: number }) => void
}

interface PointerLike { clientX: number, clientY: number, button?: number, pointerType?: string }

/**
 * Calls `onLongPress` when a finger (or mouse) stays on `element` for
 * `delay`. The click that follows a long press is swallowed, so a long press
 * on a link opens its menu without also following it, and the browser's own
 * callout menu is kept out of the way.
 */
export function observeLongPress(element: HTMLElement, options: LongPressOptions): () => void {
  const delay = options.delay ?? 500
  const tolerance = options.tolerance ?? 10
  let timer: ReturnType<typeof setTimeout> | null = null
  let start: { x: number, y: number } | null = null
  let fired = false

  const cancel = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
    if (start && !fired) options.onPressEnd?.()
    start = null
  }

  const onDown = (event: Event): void => {
    const pointer = event as unknown as PointerLike
    if (pointer.button !== undefined && pointer.button !== 0) return
    fired = false
    start = { x: pointer.clientX, y: pointer.clientY }
    options.onPressStart?.()
    timer = setTimeout(() => {
      timer = null
      if (!start) return
      fired = true
      options.onLongPress({ ...start })
      start = null
    }, delay)
  }

  const onMove = (event: Event): void => {
    if (!start) return
    const pointer = event as unknown as PointerLike
    if (Math.hypot(pointer.clientX - start.x, pointer.clientY - start.y) > tolerance) cancel()
  }

  const onClick = (event: Event): void => {
    if (!fired) return
    fired = false
    event.preventDefault()
    event.stopPropagation()
  }

  // The browser's own long-press menu (copy, share, open link).
  const onContextMenu = (event: Event): void => event.preventDefault()

  element.addEventListener('pointerdown', onDown)
  element.addEventListener('pointermove', onMove)
  element.addEventListener('pointerup', cancel)
  element.addEventListener('pointercancel', cancel)
  element.addEventListener('pointerleave', cancel)
  element.addEventListener('click', onClick, true)
  element.addEventListener('contextmenu', onContextMenu)
  return () => {
    cancel()
    element.removeEventListener('pointerdown', onDown)
    element.removeEventListener('pointermove', onMove)
    element.removeEventListener('pointerup', cancel)
    element.removeEventListener('pointercancel', cancel)
    element.removeEventListener('pointerleave', cancel)
    element.removeEventListener('click', onClick, true)
    element.removeEventListener('contextmenu', onContextMenu)
  }
}

/** Which of `count` equal segments across `rect` the x coordinate is over, clamped to the ends. */
export function segmentAt(x: number, rect: { left: number, width: number }, count: number): number {
  if (count <= 1 || rect.width <= 0) return 0
  const index = Math.floor(((x - rect.left) / rect.width) * count)
  return Math.max(0, Math.min(count - 1, index))
}

export interface SegmentScrubOptions {
  count: () => number
  /** The segment currently chosen: a drag that starts on it scrubs. */
  selected: () => number
  /** The finger went down on the thumb, or let go: shrink it, as UISegmentedControl does. */
  onPress?: (pressed: boolean) => void
  /** The segment under the finger while scrubbing. */
  onScrub: (index: number) => void
  /** Let go over a segment. */
  onCommit: (index: number) => void
}

/**
 * Scrubbing a segmented control: a finger that lands on the chosen segment and
 * slides drags the thumb across, and lifting chooses where it stopped. A tap
 * elsewhere stays the button's own click.
 */
export function observeSegmentScrub(track: HTMLElement, options: SegmentScrubOptions): () => void {
  let active: number | null = null
  let pointerId: number | null = null
  let moved = false
  let current = 0

  const indexAt = (x: number): number => {
    const rect = track.getBoundingClientRect()
    // The track's 2px inset on each side is not a segment.
    return segmentAt(x, { left: rect.left + 2, width: rect.width - 4 }, options.count())
  }

  const onDown = (event: Event): void => {
    const pointer = event as unknown as PointerLike & { pointerId: number }
    if (pointer.button !== undefined && pointer.button !== 0) return
    const index = indexAt(pointer.clientX)
    if (index !== options.selected()) return
    active = index
    current = index
    moved = false
    pointerId = pointer.pointerId
    try {
      track.setPointerCapture?.(pointer.pointerId)
    }
    catch {}
    options.onPress?.(true)
  }

  const onMove = (event: Event): void => {
    if (active === null) return
    const index = indexAt((event as unknown as PointerLike).clientX)
    if (index === current) return
    moved = true
    current = index
    options.onScrub(index)
  }

  const finish = (commit: boolean): void => {
    if (active === null) return
    if (pointerId !== null) {
      try {
        track.releasePointerCapture?.(pointerId)
      }
      catch {}
    }
    options.onPress?.(false)
    if (commit && moved) options.onCommit(current)
    else if (moved) options.onScrub(active)
    active = null
    pointerId = null
  }

  // A scrub that moved ends in its own choice; the click it would also make
  // on whatever segment it ended over is not a second one.
  const onClick = (event: Event): void => {
    if (!moved) return
    moved = false
    event.preventDefault()
    event.stopPropagation()
  }

  const onUp = (): void => finish(true)
  const onCancel = (): void => finish(false)
  track.addEventListener('pointerdown', onDown)
  track.addEventListener('pointermove', onMove)
  track.addEventListener('pointerup', onUp)
  track.addEventListener('pointercancel', onCancel)
  track.addEventListener('click', onClick, true)
  return () => {
    track.removeEventListener('pointerdown', onDown)
    track.removeEventListener('pointermove', onMove)
    track.removeEventListener('pointerup', onUp)
    track.removeEventListener('pointercancel', onCancel)
    track.removeEventListener('click', onClick, true)
  }
}

/** The segment an arrow, Home or End key moves to from `index`, or null for any other key. */
export function segmentForKey(key: string, index: number, count: number): number | null {
  if (count <= 0) return null
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

/**
 * Wakes the Taptic Engine as a finger lands on anything marked
 * `data-native-pressable`, so the tap that follows its press plays at once.
 *
 * Listening for touchstart at all is also what makes iOS apply `:active`, the
 * pressed state the shell's stylesheet draws.
 */
export function installPressables(root: EventTarget): () => void {
  const onTouch = (event: Event): void => {
    const target = event.target as Element | null
    if (!target?.closest?.('[data-native-pressable]')) return
    const prepare = nativeFunctionNow('haptics.prepare')
    if (prepare) void Promise.resolve().then(() => prepare('impact')).catch(() => {})
  }
  root.addEventListener('touchstart', onTouch, { passive: true, capture: true })
  return () => root.removeEventListener('touchstart', onTouch, { capture: true } as EventListenerOptions)
}
