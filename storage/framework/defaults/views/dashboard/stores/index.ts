import { defineStore, registerStoresClient } from '@stacksjs/stx'

/**
 * Dashboard Store — shared state across all dashboard pages.
 * Persists sidebar state and user preferences across SPA navigation.
 */
export const dashboardStore = defineStore('dashboard', {
  state: {
    currentPage: 'home',
    sidebarCollapsed: false,
    searchQuery: '',
    timeRange: '7d',
    notifications: [] as Array<{ id: string, title: string, type: string, read: boolean }>,
    theme: 'system' as 'light' | 'dark' | 'system',
  },

  getters: {
    unreadCount: (state) => state.notifications.filter(n => !n.read).length,
    isDark: (state) => {
      if (state.theme === 'system') {
        return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      }
      return state.theme === 'dark'
    },
  },

  actions: {
    navigate(pageId: string) {
      this.currentPage = pageId
    },
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },
    setTimeRange(range: string) {
      this.timeRange = range
    },
    setTheme(theme: 'light' | 'dark' | 'system') {
      this.theme = theme
    },
    markNotificationRead(id: string) {
      const notification = this.notifications.find(n => n.id === id)
      if (notification) notification.read = true
    },
  },

  persist: {
    storage: 'local',
    key: 'stacks-dashboard',
    paths: ['sidebarCollapsed', 'timeRange', 'theme'],
  },
})

/**
 * Stats Store — dashboard overview data.
 * Loaded server-side, refreshable from client.
 */
export const statsStore = defineStore('stats', {
  state: {
    stats: [] as Array<{ title: string, value: string, trend: number, trendLabel: string, icon: string }>,
    systemHealth: [] as Array<{ name: string, status: string, latency: string, uptime: string }>,
    recentActivity: [] as Array<{ type: string, title: string, time: string, status: string }>,
    isLoading: false,
    lastFetched: null as string | null,
  },

  getters: {
    healthyServices: (state) => state.systemHealth.filter(s => s.status === 'healthy').length,
    totalServices: (state) => state.systemHealth.length,
    hasErrors: (state) => state.recentActivity.some(a => a.status === 'error'),
  },

  actions: {
    async refresh() {
      this.isLoading = true
      try {
        const res = await fetch('/api/dashboard/stats')
        if (res.ok) {
          const data = await res.json()
          this.stats = data.stats || this.stats
          this.systemHealth = data.systemHealth || this.systemHealth
          this.recentActivity = data.recentActivity || this.recentActivity
          this.lastFetched = new Date().toISOString()
        }
      }
      catch {
        // API may not be available — keep existing data
      }
      finally {
        this.isLoading = false
      }
    },
  },

  persist: {
    storage: 'session',
    key: 'stacks-dashboard-stats',
  },
})

// Register stores for client-side @stores imports
if (typeof window !== 'undefined') {
  registerStoresClient({ dashboardStore, statsStore })
}
