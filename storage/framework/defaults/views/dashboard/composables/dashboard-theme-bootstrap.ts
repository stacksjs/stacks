import { applyDashboardTheme, readDashboardThemes, resolveDashboardTheme } from './dashboard-themes'

const root = document.documentElement
try {
  const { active, installed } = readDashboardThemes(window.localStorage)
  applyDashboardTheme(root, resolveDashboardTheme(active, installed))
}
catch {
  // The browser can refuse access to localStorage itself.
  applyDashboardTheme(root)
}

// Router options are read at startup. Settings uses a persistent window shell
// and immediate pane changes, including Back and Forward in that window.
if (document.currentScript?.hasAttribute('data-settings-router')) {
  const settingsWindow = window as Window & { STX_ROUTER_OPTIONS?: { viewTransitions?: boolean, routeFocus?: boolean, progress?: boolean } }
  settingsWindow.STX_ROUTER_OPTIONS = { ...settingsWindow.STX_ROUTER_OPTIONS, viewTransitions: false, routeFocus: false, progress: false }
}
