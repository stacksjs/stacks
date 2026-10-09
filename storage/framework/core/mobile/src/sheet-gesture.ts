/**
 * What makes a bottom sheet behave like a UISheetPresentationController:
 * dragged by its grabber or header, flicked away, resting at a medium or a
 * large detent, and holding the page behind it still and out of reach.
 */

export type SheetDetent = 'medium' | 'large'
export type SheetSettle = SheetDetent | 'dismiss'

/** A resting place, as the panel's downward offset from its fully open position. */
export interface SheetStop {
  name: SheetSettle
  y: number
}

/** A flick faster than this (CSS pixels a millisecond) moves on to the next stop. */
export const SHEET_FLICK_VELOCITY = 0.5

/**
 * Where each detent leaves a panel `height` tall on a `viewport` tall screen:
 * large shows all of it, medium the bottom half of the screen, and dismissed
 * none.
 */
export function sheetStops(height: number, viewport: number, detents: readonly SheetDetent[]): SheetStop[] {
  const stops: SheetStop[] = []
  if (detents.includes('large') || detents.length === 0) stops.push({ name: 'large', y: 0 })
  if (detents.includes('medium')) stops.push({ name: 'medium', y: Math.max(0, Math.round(height - viewport * 0.5)) })
  stops.push({ name: 'dismiss', y: Math.max(1, height) })
  return stops.sort((a, b) => a.y - b.y)
}

/**
 * Where a released sheet goes.
 *
 * A flick (faster than 0.5px/ms) goes on to the next stop in its direction,
 * past the lowest detent meaning dismissed. A slow release dismisses once the
 * sheet is more than half way down from its lowest detent, and otherwise
 * springs back to the nearest detent.
 */
export function settleSheet(state: { y: number, velocity: number, stops: SheetStop[] }): SheetSettle {
  const { y, velocity, stops } = state
  const detents = stops.filter(stop => stop.name !== 'dismiss')
  const dismiss = stops.find(stop => stop.name === 'dismiss')!
  if (detents.length === 0) return 'dismiss'

  if (velocity > SHEET_FLICK_VELOCITY) {
    const below = stops.filter(stop => stop.y > y + 1)
    return (below[0] ?? dismiss).name
  }
  if (velocity < -SHEET_FLICK_VELOCITY) {
    const above = detents.filter(stop => stop.y < y - 1)
    return (above[above.length - 1] ?? detents[0]!).name
  }

  const lowest = detents[detents.length - 1]!
  if (y > lowest.y + (dismiss.y - lowest.y) * 0.5) return 'dismiss'
  return detents.reduce((best, stop) => (Math.abs(stop.y - y) < Math.abs(best.y - y) ? stop : best)).name
}

/** iOS's resistance past the top: the further it is pulled, the less it gives. */
export function rubberBand(overshoot: number, dimension = 400): number {
  if (overshoot <= 0) return 0
  return (overshoot * dimension * 0.55) / (dimension + overshoot * 0.55)
}

export interface SheetDragOptions {
  panel: HTMLElement
  /** Where a drag may start: the grabber and the header. */
  handles: HTMLElement[]
  detents: () => SheetDetent[]
  detent: () => SheetDetent
  /** The viewport's height, for where medium rests. */
  viewport?: () => number
  onSettle: (to: SheetSettle) => void
}

interface PointerLike { clientY: number, pointerId: number, button?: number, timeStamp: number, target: EventTarget | null }

/**
 * Lets a sheet be dragged by its handles. While dragging, the panel follows
 * the finger with `is-dragging` set (the stylesheet turns its transition off)
 * and its parent's `--native-sheet-presence` (1 open, 0 gone) dims the
 * backdrop to match; on release both are handed back to the stylesheet, which
 * animates to wherever `onSettle` puts it.
 */
export function observeSheetDrag(options: SheetDragOptions): () => void {
  const { panel } = options
  let start: { y: number, base: number, pointerId: number } | null = null
  let samples: Array<{ y: number, t: number }> = []
  let offset = 0

  const stops = (): SheetStop[] => sheetStops(panel.offsetHeight || panel.getBoundingClientRect().height, options.viewport?.() ?? 800, options.detents())

  const onDown = (event: Event): void => {
    const pointer = event as unknown as PointerLike
    if (pointer.button !== undefined && pointer.button !== 0) return
    // The header's own buttons (Done) stay buttons.
    if ((pointer.target as Element | null)?.closest?.('button, a, input, select, textarea, [role=button]')) return
    const resting = stops().find(stop => stop.name === options.detent())?.y ?? 0
    start = { y: pointer.clientY, base: resting, pointerId: pointer.pointerId }
    offset = resting
    samples = [{ y: resting, t: pointer.timeStamp }]
    panel.classList.add('is-dragging')
    try {
      (event.currentTarget as Element | null)?.setPointerCapture?.(pointer.pointerId)
    }
    catch {}
  }

  const onMove = (event: Event): void => {
    if (!start) return
    const pointer = event as unknown as PointerLike
    const raw = start.base + pointer.clientY - start.y
    offset = raw < 0 ? -rubberBand(-raw) : raw
    samples.push({ y: offset, t: pointer.timeStamp })
    // Only the last tenth of a second says how fast it is going now.
    while (samples.length > 2 && pointer.timeStamp - samples[0]!.t > 100) samples.shift()
    panel.style.transform = `translateY(${offset}px)`
    const height = panel.offsetHeight || 1
    panel.parentElement?.style.setProperty('--native-sheet-presence', String(Math.max(0, Math.min(1, 1 - offset / height))))
  }

  const onEnd = (event: Event): void => {
    if (!start) return
    const pointer = event as unknown as PointerLike
    start = null
    const first = samples[0]!
    const elapsed = Math.max(1, pointer.timeStamp - first.t)
    const velocity = (offset - first.y) / elapsed
    panel.classList.remove('is-dragging')
    panel.style.transform = ''
    panel.parentElement?.style.removeProperty('--native-sheet-presence')
    options.onSettle(settleSheet({ y: offset, velocity, stops: stops() }))
  }

  for (const handle of options.handles) {
    handle.addEventListener('pointerdown', onDown)
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onEnd)
    handle.addEventListener('pointercancel', onEnd)
  }
  return () => {
    for (const handle of options.handles) {
      handle.removeEventListener('pointerdown', onDown)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onEnd)
      handle.removeEventListener('pointercancel', onEnd)
    }
  }
}

let scrollLocks = 0
let savedOverflow = ''

/**
 * Holds the page still and out of reach behind `keep`: everything outside it
 * becomes inert (no taps, no focus, hidden from VoiceOver) and the document
 * stops scrolling. Returns the release. Nested sheets count, so the page
 * scrolls again only once the last has closed.
 */
export function lockBackground(keep: HTMLElement): () => void {
  const doc = keep.ownerDocument
  const madeInert: Element[] = []
  let node: HTMLElement = keep
  while (node.parentElement && node !== doc.body) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (sibling === node || sibling.hasAttribute('inert') || sibling.hasAttribute('data-native-dialog')) continue
      if (['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK'].includes(sibling.tagName)) continue
      sibling.setAttribute('inert', '')
      madeInert.push(sibling)
    }
    node = node.parentElement
  }

  const root = doc.documentElement
  if (scrollLocks++ === 0) {
    savedOverflow = root.style.overflow || ''
    root.style.overflow = 'hidden'
  }

  let released = false
  return () => {
    if (released) return
    released = true
    for (const element of madeInert) element.removeAttribute('inert')
    if (--scrollLocks === 0) {
      if (savedOverflow) root.style.overflow = savedOverflow
      else root.style.removeProperty('overflow')
    }
  }
}

/**
 * Moves `element` to the end of the body, out of every stacking context and
 * transform on the way, and returns the way back: to where it was, or out of
 * the document when that place has gone (the page navigated away).
 */
export function liftToBody(element: HTMLElement): () => void {
  const doc = element.ownerDocument
  if (element.parentElement === doc.body) return () => {}
  const placeholder = doc.createComment('native-sheet')
  element.parentNode?.insertBefore(placeholder, element)
  doc.body.appendChild(element)
  return () => {
    if (placeholder.parentNode) placeholder.parentNode.insertBefore(element, placeholder)
    else element.remove()
    placeholder.remove()
  }
}

/**
 * The iOS card presentation: while a large sheet is up, the page behind it
 * shrinks back from the screen's edges, centred on what was in view. Undone by
 * calling it with `false`.
 */
export function presentPageAsCard(doc: Document, on: boolean): void {
  const root = doc.documentElement
  if (!on) {
    root.removeAttribute('data-native-sheet-card')
    return
  }
  const view = doc.defaultView
  const centre = (view?.scrollY ?? 0) + (view?.innerHeight ?? 800) / 2
  root.style.setProperty('--native-sheet-card-origin', `${Math.round(centre)}px`)
  root.setAttribute('data-native-sheet-card', '')
}
