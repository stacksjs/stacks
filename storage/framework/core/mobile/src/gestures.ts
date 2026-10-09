/**
 * Touch behaviour a phone app expects from its screens, for the page itself.
 *
 * These live here rather than in the components that use them because they
 * read the scroll position and touch coordinates, which an STX template must
 * not reach for directly, and because the arithmetic is worth testing on its
 * own. The components stay a few lines of wiring.
 */
import { haptics } from 'craft-native/mobile'

/**
 * Where a page scrolls: the window, a scrolling element (a screen that scrolls
 * inside its own container), or a stand-in with the same shape.
 */
export interface ScrollHost extends EventTarget {
  scrollY?: number
  scrollTop?: number
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
  if (typeof host.scrollTop === 'number') return host.scrollTop
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
  /**
   * Every change in how far the page is pulled, and whether letting go would
   * refresh. `bounce` is how much of the distance iOS's own rubber band has
   * already moved the page by, which the content need not be moved by again.
   */
  onPull?: (distance: number, armed: boolean, pull: { bounce: number }) => void
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
    options.onPull?.(distance, armed, { bounce: Math.min(distance, Math.max(0, -pageScrollTop(host))) })
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

export interface LargeTitleMetrics {
  /** 0 with the large title in full view, 1 once it has scrolled under the bar. */
  progress: number
  /** The large title's scale: above 1 while the page is pulled past its top, as on iOS. */
  stretch: number
}

/**
 * Where a large-title navigation bar is for a scroll offset.
 *
 * The title collapses over its own height. Pulled past the top (iOS's rubber
 * band, a negative offset) it grows a little, at most 10%, anchored at its
 * leading edge.
 */
export function largeTitleMetrics(offset: number, height = 52): LargeTitleMetrics {
  const span = Math.max(1, height)
  const progress = Math.min(1, Math.max(0, offset / span))
  const stretch = offset < 0 ? 1 + Math.min(0.1, -offset / 600) : 1
  return { progress: Math.round(progress * 1000) / 1000, stretch: Math.round(stretch * 1000) / 1000 }
}

export interface LargeTitleOptions {
  /** The large title's height in pixels; read from `title` when that is given. */
  height?: number
  /** The large title element, measured for its height. */
  title?: HTMLElement | null
  host?: ScrollHost
  /** Each frame's metrics, for a caller that wants more than the custom properties. */
  onChange?: (metrics: LargeTitleMetrics) => void
}

/**
 * Links a navigation bar to the page's scroll, a frame at a time.
 *
 * Writes `--native-nav-progress` (0 to 1) and `--native-nav-stretch` on
 * `element`, so its CSS can fade the material in, move the small title into
 * the bar and stretch the large one, all on the compositor. Nothing re-renders.
 */
export function observeLargeTitle(element: HTMLElement, options: LargeTitleOptions = {}): () => void {
  let last = ''
  const height = (): number => options.title?.offsetHeight || options.height || 52
  return observePageScroll((offset) => {
    const metrics = largeTitleMetrics(offset, height())
    const key = `${metrics.progress}|${metrics.stretch}`
    if (key === last) return
    last = key
    element.style.setProperty('--native-nav-progress', String(metrics.progress))
    element.style.setProperty('--native-nav-stretch', String(metrics.stretch))
    options.onChange?.(metrics)
  }, options.host)
}

/**
 * The element a selector names, as a scroll host: for a screen whose content
 * scrolls inside a container rather than the page. Undefined (the window)
 * when nothing matches.
 */
export function resolveScrollHost(selector: string | null | undefined): ScrollHost | undefined {
  if (!selector || typeof window === 'undefined') return undefined
  const found = window.document?.querySelector(selector)
  return found ? found as unknown as ScrollHost : undefined
}
