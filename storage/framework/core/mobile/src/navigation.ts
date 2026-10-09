/**
 * Back navigation for a screen pushed inside the app.
 *
 * A back button that links to its parent reloads the parent at the top, where
 * a phone user expects to land back where they were in the list. Going back
 * through history keeps that. It is only safe when the entry being left was
 * pushed by the app: the STX router marks the entries it pushes, while the
 * entry a cold start (or a link from another site) opens with carries only
 * its scroll token, or nothing. There the button follows its link instead, so
 * it never leaves the app.
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

/** The STX router's mark on an entry it pushed. */
const PUSHED_MARK = '__stxPushed'
/** The STX router's scroll token, on every entry, the first one too. */
const SCROLL_TOKEN = '__stxScroll'

/** Whether going back stays inside this app. */
export function canGoBack(host: HistoryHost | undefined = historyHost()): boolean {
  const state = host?.history?.state
  if (state === null || state === undefined) return false
  if (typeof state !== 'object') return true
  const entry = state as Record<string, unknown>
  if (PUSHED_MARK in entry) return entry[PUSHED_MARK] === true
  // A scroll token alone is the router stamping the entry the app opened
  // with: going back from it leaves the app, or does nothing in a phone app.
  return !(SCROLL_TOKEN in entry)
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

/** A screen the app has shown, by the path it was at and the name it showed. */
export interface NavTrailEntry {
  path: string
  title: string
}

/**
 * Records arriving at `path` on the trail of screens, and answers this
 * screen's entry and the one a back button returns to.
 *
 * Arriving at the screen just before the current one is going back, so the
 * current one is dropped; arriving at the current one again (a reload, a
 * re-render) changes nothing; anything else is a push. The trail is capped,
 * oldest first.
 */
export function enterNavTrail(trail: NavTrailEntry[], path: string, limit = 50): { current: NavTrailEntry, previous: NavTrailEntry | null } {
  const last = trail[trail.length - 1]
  if (trail.length >= 2 && trail[trail.length - 2]!.path === path)
    trail.pop()
  else if (!last || last.path !== path)
    trail.push({ path, title: '' })
  if (trail.length > limit)
    trail.splice(0, trail.length - limit)
  return { current: trail[trail.length - 1]!, previous: trail[trail.length - 2] ?? null }
}

/**
 * What a back button says: the name of the screen it returns to, as iOS
 * does, when that is short enough to sit beside the title; otherwise the
 * button's own word ("Back", "Workout").
 */
export function backLabelFor(previous: NavTrailEntry | null, fallback: string, max = 12): string {
  const title = previous?.title.trim() ?? ''
  return title && title.length <= max ? title : fallback
}

/** The trail for this window: it outlives each screen, not a full reload. */
export function navTrail(): NavTrailEntry[] {
  if (typeof window === 'undefined') return []
  const host = window as unknown as { __stacksNavTrail?: NavTrailEntry[] }
  return (host.__stacksNavTrail ??= [])
}

interface RouterScreen {
  url: string
  tab: string
  depth: number
  active: boolean
}

function pathOf(url: string): string {
  try {
    const parsed = new URL(url, 'http://local')
    return `${parsed.pathname}${parsed.search}`
  }
  catch {
    return url
  }
}

/**
 * The path a back from the screen on show returns to, in its own tab's stack.
 *
 * The trail is one list for the window, but the stx router keeps a stack per
 * tab, so a screen opened in Calendar after a visit to Today goes back to
 * Calendar, not to whatever was entered last. Answers null at a tab's root,
 * and undefined when there is no router that keeps tabs to ask.
 */
export function previousScreenPath(): string | null | undefined {
  if (typeof window === 'undefined') return undefined
  const router = (window as unknown as { stxRouter?: { screens?: () => RouterScreen[] } }).stxRouter
  if (typeof router?.screens !== 'function') return undefined
  const screens = router.screens()
  const active = screens.find(screen => screen.active)
  if (!active) return undefined
  const below = screens.filter(screen => screen.tab === active.tab && screen.depth < active.depth)
  if (!below.length) return null
  return pathOf(below.reduce((nearest, screen) => (screen.depth > nearest.depth ? screen : nearest)).url)
}

/** The latest trail entry for `path`, which carries that screen's name. */
export function trailEntryFor(trail: NavTrailEntry[], path: string): NavTrailEntry | null {
  for (let index = trail.length - 1; index >= 0; index--) {
    if (trail[index]!.path === path) return trail[index]!
  }
  return null
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
