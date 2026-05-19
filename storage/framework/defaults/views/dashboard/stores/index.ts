import { defineStore, derived, registerStoresClient, state } from '@stacksjs/stx'
import { isDarkTheme, useTheme } from '../composables/useTheme'

/**
 * Dashboard Store — shared state across all dashboard pages.
 * Persists sidebar state and user preferences across SPA navigation.
 *
 * Setup-function style (recommended in stx 0.2.x). Each piece of state
 * is a signal; derived values use `derived(() => …)`; actions are plain
 * functions. The store object returned at the bottom is what consumers
 * see when they import `dashboardStore` or call `useStore('dashboard')`.
 */
export const dashboardStore = defineStore('dashboard', () => {
  const currentPage = state('home')
  const sidebarCollapsed = state(false)
  const searchQuery = state('')
  const timeRange = state('7d')
  const notifications = state<Array<{ id: string, title: string, type: string, read: boolean }>>([])
  const theme = state<'light' | 'dark' | 'system'>('system')

  const unreadCount = derived(() => notifications().filter(n => !n.read).length)

  // OS dark-mode preference now lives in `useTheme()` (stacksjs/stacks#1838)
  // — the store no longer reaches into `window.matchMedia` directly. The
  // composable installs a single listener at module load and exposes the
  // signal so this derived re-runs when the OS flips theme.
  const { prefersDark } = useTheme()

  const isDark = derived(() => isDarkTheme(theme(), prefersDark()))

  function navigate(pageId: string): void {
    currentPage.set(pageId)
  }
  function toggleSidebar(): void {
    sidebarCollapsed.set(!sidebarCollapsed())
  }
  function setSearchQuery(query: string): void {
    searchQuery.set(query)
  }
  function setTimeRange(range: string): void {
    timeRange.set(range)
  }
  function setTheme(next: 'light' | 'dark' | 'system'): void {
    theme.set(next)
  }
  function markNotificationRead(id: string): void {
    notifications.update(list => list.map(n => n.id === id ? { ...n, read: true } : n))
  }

  return {
    currentPage,
    sidebarCollapsed,
    searchQuery,
    timeRange,
    notifications,
    theme,
    unreadCount,
    isDark,
    navigate,
    toggleSidebar,
    setSearchQuery,
    setTimeRange,
    setTheme,
    markNotificationRead,
  }
}, {
  persist: {
    storage: 'localStorage',
    key: 'stacks-dashboard',
    pick: ['sidebarCollapsed', 'timeRange', 'theme'],
  },
})

/**
 * Stats Store — dashboard overview data.
 * Loaded server-side, refreshable from client.
 */
export const statsStore = defineStore('stats', () => {
  const stats = state<Array<{ title: string, value: string, trend: number, trendLabel: string, icon: string }>>([])
  const systemHealth = state<Array<{ name: string, status: string, latency: string, uptime: string }>>([])
  const recentActivity = state<Array<{ type: string, title: string, time: string, status: string }>>([])
  const isLoading = state(false)
  const lastFetched = state<string | null>(null)

  const healthyServices = derived(() => systemHealth().filter(s => s.status === 'healthy').length)
  const totalServices = derived(() => systemHealth().length)
  const hasErrors = derived(() => recentActivity().some(a => a.status === 'error'))

  async function refresh(): Promise<void> {
    isLoading.set(true)
    try {
      const res = await fetch('/api/dashboard/stats')
      if (res.ok) {
        const data = await res.json()
        if (data.stats) stats.set(data.stats)
        if (data.systemHealth) systemHealth.set(data.systemHealth)
        if (data.recentActivity) recentActivity.set(data.recentActivity)
        lastFetched.set(new Date().toISOString())
      }
    }
    catch {
      // API may not be available — keep existing data
    }
    finally {
      isLoading.set(false)
    }
  }

  return {
    stats,
    systemHealth,
    recentActivity,
    isLoading,
    lastFetched,
    healthyServices,
    totalServices,
    hasErrors,
    refresh,
  }
}, {
  persist: {
    storage: 'sessionStorage',
    key: 'stacks-dashboard-stats',
  },
})

// Register stores for client-side `@stores` imports.
if (typeof window !== 'undefined')
  registerStoresClient({ dashboardStore, statsStore })
