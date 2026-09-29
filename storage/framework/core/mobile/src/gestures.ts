/**
 * Touch behaviour a phone app expects from its screens, for the page itself.
 *
 * These live here rather than in the components that use them because they
 * read the scroll position and touch coordinates, which an STX template must
 * not reach for directly, and because the arithmetic is worth testing on its
 * own. The components stay a few lines of wiring.
 */
import { haptics } from 'craft-native/mobile'

/** Where a page scrolls: the window, or a stand-in with the same shape. */
export interface ScrollHost extends EventTarget {
  scrollY?: number
  document?: { scrollingElement?: { scrollTop: number } | null }
}

function scrollHost(): ScrollHost | undefined {
  if (typeof window === 'undefined') return undefined
  return window as unknown as ScrollHost
}

/**
 * The page's vertical scroll offset. Negative while iOS rubber-bands past the
 * top, which is what pull-to-refresh reads.
 */
export function pageScrollTop(host: ScrollHost | undefined = scrollHost()): number {
  if (!host) return 0
  if (typeof host.scrollY === 'number') return host.scrollY
  return host.document?.scrollingElement?.scrollTop ?? 0
}

/**
 * Calls `callback` with the page's scroll offset now and on every scroll, at
 * most once a frame. Returns the unsubscribe.
 */
export function observePageScroll(callback: (offset: number) => void, host: ScrollHost | undefined = scrollHost()): () => void {
  if (!host) return () => {}
  let queued = false
  const frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (run: () => void) => setTimeout(run, 16)
  const listener = (): void => {
    if (queued) return
    queued = true
    frame(() => {
      queued = false
      callback(pageScrollTop(host))
    })
  }
  callback(pageScrollTop(host))
  host.addEventListener('scroll', listener, { passive: true })
  return () => host.removeEventListener('scroll', listener)
}

export interface PullToRefreshOptions {
  /** How far, in CSS pixels, a pull must travel to refresh. Default 72. */
  threshold?: number
  /** Every change in how far the page is pulled, and whether letting go would refresh. */
  onPull?: (distance: number, armed: boolean) => void
  /** Runs once per completed pull. Pulls are ignored until it settles. */
  onRefresh: () => unknown | Promise<unknown>
  /** Where to listen. The window by default. */
  host?: ScrollHost
}

/**
 * How far a pull has travelled.
 *
 * iOS rubber-bands the page past its top, so the scroll offset itself goes
 * negative and carries the system's own resistance curve. Android and desktop
 * browsers stop at zero, so there the finger's travel counts, halved to feel
 * like the same resistance.
 */
export function pullDistance(scrollTop: number, fingerTravel: number): number {
  const bounce = Math.max(0, -scrollTop)
  const drag = scrollTop <= 0 ? Math.max(0, fingerTravel) * 0.5 : 0
  return Math.round(Math.max(bounce, drag))
}

/**
 * Pull-to-refresh for the whole page.
 *
 * A pull starts only with the page at its top. Crossing the threshold gives a
 * medium haptic tap, the moment a native list does; pulling back under 80% of
 * it disarms. Letting go while armed runs `onRefresh`.
 */
export function observePullToRefresh(options: PullToRefreshOptions): () => void {
  const host = options.host ?? scrollHost()
  if (!host) return () => {}
  const threshold = options.threshold ?? 72

  let startY: number | null = null
  let armed = false
  let refreshing = false

  // Touches arrive faster than the screen draws, twice as fast again on a
  // 120Hz display, and each report restyles the indicator. A pull's moves are
  // coalesced into one report a frame; its ends report at once.
  const frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (run: () => void) => setTimeout(run, 16)
  let queued: number | null = null
  const report = (distance: number): void => {
    queued = null
    options.onPull?.(distance, armed)
  }
  const reportNextFrame = (distance: number): void => {
    const scheduled = queued !== null
    queued = distance
    if (scheduled) return
    frame(() => {
      if (queued !== null) report(queued)
    })
  }

  const touchY = (event: Event): number | null => {
    const touch = (event as TouchEvent).touches?.[0]
    return touch ? touch.clientY : null
  }

  const onStart = (event: Event): void => {
    if (refreshing || pageScrollTop(host) > 0) return
    startY = touchY(event)
    armed = false
  }

  const onMove = (event: Event): void => {
    if (startY === null) return
    const y = touchY(event)
    if (y === null) return
    const distance = pullDistance(pageScrollTop(host), y - startY)
    if (!armed && distance >= threshold) {
      armed = true
      void Promise.resolve(haptics.impact('medium')).catch(() => {})
    }
    else if (armed && distance < threshold * 0.8) {
      armed = false
    }
    reportNextFrame(distance)
  }

  const onEnd = async (): Promise<void> => {
    if (startY === null) return
    startY = null
    if (!armed) {
      report(0)
      return
    }
    armed = false
    refreshing = true
    report(threshold)
    try {
      await options.onRefresh()
    }
    finally {
      refreshing = false
      report(0)
    }
  }

  // A cancelled touch (a system gesture took it) never refreshes.
  const onCancel = (): void => {
    if (startY === null) return
    startY = null
    armed = false
    report(0)
  }

  host.addEventListener('touchstart', onStart, { passive: true })
  host.addEventListener('touchmove', onMove, { passive: true })
  host.addEventListener('touchend', onEnd)
  host.addEventListener('touchcancel', onCancel)
  return () => {
    queued = null
    host.removeEventListener('touchstart', onStart)
    host.removeEventListener('touchmove', onMove)
    host.removeEventListener('touchend', onEnd)
    host.removeEventListener('touchcancel', onCancel)
  }
}
