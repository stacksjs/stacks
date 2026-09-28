/**
 * Back navigation for a screen pushed inside the app.
 *
 * A back button that links to its parent reloads the parent at the top, where
 * a phone user expects to land back where they were in the list. Going back
 * through history keeps that. It is only safe when the entry being left was
 * pushed by the app: the STX router pushes a state object, and the entry a
 * cold start (or a link from another site) opens with has none. There the
 * button follows its link instead, so it never leaves the app.
 */

import type { DeepLinksApi } from './types'

/** The part of the window back navigation reads. */
export interface HistoryHost {
  history?: { state: unknown, back: () => void }
}

function historyHost(): HistoryHost | undefined {
  if (typeof window === 'undefined') return undefined
  return window as unknown as HistoryHost
}

/** Whether going back stays inside this app. */
export function canGoBack(host: HistoryHost | undefined = historyHost()): boolean {
  const state = host?.history?.state
  return state !== null && state !== undefined
}

/**
 * Goes back through history when that stays inside the app, and says whether
 * it did. When it answers `false` the caller follows its own link.
 */
export function goBack(host: HistoryHost | undefined = historyHost()): boolean {
  if (!canGoBack(host)) return false
  host!.history!.back()
  return true
}

/**
 * The in-app path a deep link opens, or null when it is not this app's.
 *
 * A custom scheme carries the path after it — `myapp://m/workout/5` and
 * `myapp:///m/workout/5` both open `/m/workout/5` — and a universal link on
 * this app's origin opens its own path. A link to anywhere else is not
 * followed from inside the app.
 */
export function deepLinkPath(link: string, origin: string | undefined = currentOrigin()): string | null {
  let url: URL
  try {
    url = new URL(link)
  }
  catch {
    return null
  }
  const rest = `${url.search}${url.hash}`
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    if (!origin || url.origin !== origin) return null
    return `${url.pathname || '/'}${rest}`
  }
  const path = `/${[url.host, url.pathname.replace(/^\/+/, '')].filter(Boolean).join('/')}`
  return `${path}${rest}`
}

function currentOrigin(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { location?: { origin?: string } }).location?.origin
}

const HANDLED_KEY = 'stacks-mobile-deep-link'

/**
 * Opens every deep link the app receives with `go`: the one it was launched
 * with, once, and each one after. Returns the unsubscribe.
 *
 * The launch link is remembered for the session, so a full page load inside
 * the app does not open it again.
 */
export function followDeepLinks(go: (path: string) => void, links: DeepLinksApi): () => void {
  const open = (link: string): void => {
    const path = deepLinkPath(link)
    if (path) go(path)
  }

  void links.getInitialURL().then((link) => {
    if (!link) return
    try {
      if (sessionStorage.getItem(HANDLED_KEY) === link) return
      sessionStorage.setItem(HANDLED_KEY, link)
    }
    catch {
      // No session storage: open it; a reload may open it again.
    }
    open(link)
  }).catch(() => {})

  return links.onLink((link, detail) => {
    // The launch link is delivered here too; getInitialURL handles it.
    if (detail?.initial) return
    open(link)
  })
}
