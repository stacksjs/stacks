/**
 * useNavigation — wraps `window.location` / `history.pushState` so
 * dashboard pages can read URL state and navigate without leaking
 * vanilla DOM access into `.stx` files (stacksjs/stacks#1838).
 *
 * stx already exposes a top-level `navigate(url)` for SPA navigation, so
 * this composable focuses on the *read* side (current path, segment
 * extraction, query params) and on a couple of write helpers that stx's
 * primitive doesn't cover (hash setters, opening external URLs).
 *
 * All accessors are SSR-safe — they return sensible defaults when
 * `window` is undefined so importing this in a page that hydrates
 * server-side doesn't crash.
 */

export interface NavigationSnapshot {
  /**
   * Current pathname, e.g. `/kanban/12`. Empty string on the server.
   */
  path: () => string

  /**
   * Path segment by index, supporting negative indexes (Pythonic). The
   * pathname is split on `/` with empty segments dropped — so
   * `urlSegment(-1)` on `/kanban/12/cards` returns `cards`, and
   * `urlSegment(0)` returns `kanban`. Returns an empty string when the
   * index is out of bounds or on the server.
   *
   * Replaces the recurring `window.location.pathname.split('/').pop()`
   * pattern from feature pages.
   */
  urlSegment: (index: number) => string

  /**
   * Numeric route parameter — convenience wrapper for the very common
   * `/feature/[id]` shape. Parses `urlSegment(-1)` as a positive integer
   * and returns `null` when it isn't one.
   */
  urlIdParam: () => number | null

  /**
   * Query string value, e.g. `urlQuery('q')` on `/search?q=foo` → `foo`.
   * Returns `null` when the param is absent or on the server.
   */
  urlQuery: (name: string) => string | null

  /**
   * Replace the current URL without a history entry (uses
   * `history.replaceState`). Useful for tab/state changes that
   * shouldn't pollute the back button.
   */
  replacePath: (next: string) => void

  /**
   * Open a URL in a new tab. Forwards `noopener,noreferrer` automatically
   * — pages shouldn't have to remember the security flags every time.
   */
  openExternal: (url: string) => void
}

export function useNavigation(): NavigationSnapshot {
  return {
    path: () => {
      if (typeof window === 'undefined') return ''
      return window.location.pathname
    },

    urlSegment: (index: number) => {
      if (typeof window === 'undefined') return ''
      const parts = window.location.pathname.split('/').filter(Boolean)
      if (parts.length === 0) return ''
      const i = index < 0 ? parts.length + index : index
      return parts[i] ?? ''
    },

    urlIdParam: () => {
      if (typeof window === 'undefined') return null
      const last = window.location.pathname.split('/').filter(Boolean).pop()
      if (!last) return null
      const n = Number(last)
      return Number.isFinite(n) && n > 0 ? n : null
    },

    urlQuery: (name: string) => {
      if (typeof window === 'undefined') return null
      return new URL(window.location.href).searchParams.get(name)
    },

    replacePath: (next: string) => {
      if (typeof window === 'undefined') return
      window.history.replaceState({}, '', next)
    },

    openExternal: (url: string) => {
      if (typeof window === 'undefined') return
      window.open(url, '_blank', 'noopener,noreferrer')
    },
  }
}
