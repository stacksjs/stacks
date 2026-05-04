/**
 * useTheme — dashboard theme composable.
 *
 * Wraps the stx `useDark` / `useColorMode` primitives so the dashboard
 * has one entry point for "is the UI dark right now?". Uses the
 * dashboardStore's `theme` field as the source of truth (light /
 * dark / system) and resolves it through stx instead of touching
 * `window.matchMedia` directly — that ad-hoc check used to live in
 * `dashboardStore.isDark` (rule #2 violation, called out in #1838).
 */
import { useColorMode } from '@stacksjs/stx/composables'
import { dashboardStore } from '../stores'

export type ThemePreference = 'light' | 'dark' | 'system'

export interface UseThemeApi {
  /** Resolved theme actually applied right now ('light' | 'dark'). */
  readonly mode: 'light' | 'dark'
  /** User preference, including 'system'. */
  readonly preference: ThemePreference
  /** Convenience boolean — true when resolved mode is 'dark'. */
  readonly isDark: boolean
  /** Set the user preference. Persists via the dashboard store. */
  set: (pref: ThemePreference) => void
  /** Toggle between explicit light and dark (drops 'system'). */
  toggle: () => void
}

// Single shared color-mode handle — ColorMode from stx writes to <html>
// classes, so creating multiple instances would fight each other.
// stx maps 'system' → its own 'auto' literal.
let _colorMode: ReturnType<typeof useColorMode> | null = null
function ensureColorMode(): ReturnType<typeof useColorMode> {
  if (!_colorMode) {
    _colorMode = useColorMode({
      storageKey: 'stacks-dashboard-theme',
      initialMode: dashboardStore.theme === 'system' ? 'auto' : dashboardStore.theme,
    })
  }
  return _colorMode
}

function toStxMode(p: ThemePreference): 'light' | 'dark' | 'auto' {
  return p === 'system' ? 'auto' : p
}

function fromStxMode(p: 'light' | 'dark' | 'auto'): ThemePreference {
  return p === 'auto' ? 'system' : p
}

export function useTheme(): UseThemeApi {
  const cm = ensureColorMode()
  return {
    get mode() { return cm.mode },
    get preference() { return fromStxMode(cm.preference) },
    get isDark() { return cm.isDark },
    set(pref: ThemePreference) {
      cm.set(toStxMode(pref))
      dashboardStore.setTheme(pref)
    },
    toggle() {
      cm.toggle()
      // Re-sync the store with whatever stx resolved the toggle to.
      dashboardStore.setTheme(fromStxMode(cm.preference))
    },
  }
}
