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
