/**
 * What makes a bottom sheet behave like a UISheetPresentationController:
 * dragged by its grabber or header, flicked away, resting at a medium or a
 * large detent, lifted out of the page and pressing it back into a card.
 *
 * Holding the page behind a sheet still and out of reach, Escape, the Tab
 * trap and handing focus back are the stx overlay stack's
 * (`@stacksjs/components/overlays`), which NativeSheet joins, so a sheet
 * nests with dialogs, drawers and confirmations instead of competing with
 * them.
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
  /** The viewport's height, for where medium rests; the panel's window's by default. */
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

  const viewport = (): number => options.viewport?.() ?? panel.ownerDocument?.defaultView?.innerHeight ?? 800
  const stops = (): SheetStop[] => sheetStops(panel.offsetHeight || panel.getBoundingClientRect().height, viewport(), options.detents())

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

/** How many open sheets want the page pressed into a card, per document. */
const cardHolds = new WeakMap<Document, number>()

/**
 * The iOS card presentation: while a large sheet is up, the page behind it
 * shrinks back from the screen's edges, centred on what was in view.
 *
 * Counted: each call with `true` is let go by one with `false`, and the page
 * stays a card until the last sheet that asked lets go, so a sheet closing
 * over another large one does not flatten the page under it.
 */
export function presentPageAsCard(doc: Document, on: boolean): void {
  const root = doc.documentElement
  const held = cardHolds.get(doc) ?? 0
  if (!on) {
    const left = Math.max(0, held - 1)
    cardHolds.set(doc, left)
    if (left === 0) root.removeAttribute('data-native-sheet-card')
    return
  }
  cardHolds.set(doc, held + 1)
  if (held > 0) return
  const view = doc.defaultView
  const centre = (view?.scrollY ?? 0) + (view?.innerHeight ?? 800) / 2
  root.style.setProperty('--native-sheet-card-origin', `${Math.round(centre)}px`)
  root.setAttribute('data-native-sheet-card', '')
}
