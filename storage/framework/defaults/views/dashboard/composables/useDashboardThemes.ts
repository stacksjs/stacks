import type { DashboardThemePreferences } from './dashboard-themes'
import { defineStore, derived, state } from '@stacksjs/stx'
import {
  applyDashboardTheme,
  DASHBOARD_THEME_STORAGE_KEY,
  installDashboardTheme,
  ORIGINAL_DASHBOARD_THEME,
  parseDashboardTheme,
  readDashboardThemes,
  resolveDashboardTheme,
} from './dashboard-themes'

function read(): DashboardThemePreferences {
  try {
    if (typeof window !== 'undefined')
      return readDashboardThemes(window.localStorage)
  }
  catch {
    // Storage access can be disabled by the browser.
  }
  return { active: ORIGINAL_DASHBOARD_THEME, installed: [] }
}

const dashboardThemeStore = defineStore('dashboard-themes', () => {
  const preferences = state(read())
  const active = derived(() => preferences().active)
  const installed = derived(() => preferences().installed)

  function apply(next: DashboardThemePreferences): void {
    preferences.set(next)
    if (typeof document !== 'undefined')
      applyDashboardTheme(document.documentElement, resolveDashboardTheme(next.active, next.installed))
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === DASHBOARD_THEME_STORAGE_KEY || event.key === null)
        apply(read())
    })
  }

  function save(next: DashboardThemePreferences): void {
    try {
      window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, JSON.stringify(next))
    }
    catch {
      throw new Error('The browser could not save your dashboard themes.')
    }
    apply(next)
  }

  function select(id: string): void {
    const current = read()
    if (id === ORIGINAL_DASHBOARD_THEME || resolveDashboardTheme(id, current.installed))
      save({ ...current, active: id })
  }

  function install(value: unknown): string {
    const theme = parseDashboardTheme(value)
    save(installDashboardTheme(read(), theme))
    return theme.name
  }

  function remove(id: string): void {
    const current = read()
    if (!current.installed.some(theme => theme.id === id))
      return
    save({
      active: current.active === id ? ORIGINAL_DASHBOARD_THEME : current.active,
      installed: current.installed.filter(theme => theme.id !== id),
    })
  }

  return { active, installed, select, install, remove, sync: () => apply(read()) }
})

export function useDashboardThemes(): typeof dashboardThemeStore {
  return dashboardThemeStore
}
