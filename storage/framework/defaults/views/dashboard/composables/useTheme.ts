/**
 * useTheme — single owner of the OS dark-mode preference signal
 * (stacksjs/stacks#1838).
 *
 * The original incident: `dashboardStore.isDark` derived its OS
 * preference by calling `window.matchMedia(...)` *inside the store
 * factory* — a store that imported window for its own state was one of
 * the audit's main offenders. This composable lifts that wiring out so
 * the store consumes a clean signal and pages can ask `useTheme()`
 * directly without re-reading `matchMedia` per call site.
 *
 * Behaviour:
 *
 *   - On the server, `prefersDark()` resolves to `false`. The dashboard
 *     defaults to its light palette during SSR; once the page hydrates
 *     the listener attaches and `prefersDark()` flips if the OS theme
 *     is dark, so the first repaint reflects reality.
 *   - In the browser, the listener is installed once per module load.
 *     Subsequent `useTheme()` calls reuse the same signal — no
 *     listener storm.
 *
 * Note: stx exposes its own `useDark()` / `useColorMode()` composables
 * via auto-import. Those are the right primitives for "what theme is
 * the user currently *viewing*" (which considers user preference +
 * stored override). `useTheme().prefersDark` is specifically the *OS
 * preference* — that's what `dashboardStore` resolves against when its
 * own `theme` setting is `'system'`.
 */
import { state } from '@stacksjs/stx'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeSnapshot {
  /**
   * OS-level dark-mode preference. Tracks `prefers-color-scheme: dark`
   * via a single `matchMedia` listener installed lazily on first import.
   */
  prefersDark: () => boolean
}

const prefersDarkSignal = state(false)
let installed = false

function install(): void {
  if (installed) return
  installed = true
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  prefersDarkSignal.set(mql.matches)
  mql.addEventListener('change', e => prefersDarkSignal.set(e.matches))
}

// Install at module load. The window guard inside `install()` keeps this
// safe for SSR — the signal stays at its `false` default until the
// page hydrates and re-imports the composable in the browser.
install()

export function useTheme(): ThemeSnapshot {
  return {
    prefersDark: () => prefersDarkSignal(),
  }
}

/**
 * Resolve the *effective* dark state given a user theme mode +
 * the OS preference. Pulled out as a small pure helper so consumers
 * (e.g. `dashboardStore.isDark`) can compose it without re-deriving
 * the same `'system' ? prefersDark : mode === 'dark'` ternary.
 */
export function isDarkTheme(mode: ThemeMode, prefersDark: boolean): boolean {
  if (mode === 'system') return prefersDark
  return mode === 'dark'
}
