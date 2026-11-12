/**
 * When a page says it is loading.
 *
 * Not at once. Most dashboard requests answer in a few tens of milliseconds,
 * and a loader drawn for that long is a flash: something appears, means
 * nothing, and is gone. A page waits this long first, and says it is loading
 * only if the answer has still not come.
 *
 * What a page shows meanwhile is its own: one quiet panel where the content
 * will be before a first answer (`UI/QuietLoader.stx`), and the content it
 * already has, dimmed, when it is asking again. Never placeholder shapes, and
 * never a number or an empty state it does not know to be true.
 */
export const DASHBOARD_LOADER_DELAY = 250

/**
 * Start waiting on a request. `slow` is set once it has taken long enough to
 * say so, and the function this returns ends the wait: call it when the
 * answer (or the failure) comes.
 *
 *   const settle = dashboardLoaderTimer(slow)
 *   try { ... } finally { settle() }
 */
export function dashboardLoaderTimer(slow: { set: (value: boolean) => void }, delay: number = DASHBOARD_LOADER_DELAY): () => void {
  const timer = setTimeout(() => slow.set(true), delay)
  return () => {
    clearTimeout(timer)
    slow.set(false)
  }
}

/** The classes of content that stays on screen while it is asked for again. */
export function dashboardReloadingClass(loading: boolean, base: string = ''): string {
  const classes = loading ? 'opacity-50 pointer-events-none transition-opacity duration-150' : 'transition-opacity duration-150'
  return base ? `${base} ${classes}` : classes
}
