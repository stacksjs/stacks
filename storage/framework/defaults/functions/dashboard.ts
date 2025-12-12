/**
 * Dashboard Composable
 *
 * Provides data fetching for the main dashboard overview.
 */

import { ref } from 'vue'

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3008'

export interface DashboardStats {
  title: string
  value: string
  trend: number
  trendLabel: string
  icon: string
  iconBg: string
}

export interface ActivityItem {
  id: number
  type: string
  title: string
  time: string
  status: 'success' | 'error' | 'warning'
}

export interface SystemHealthItem {
  name: string
  status: 'healthy' | 'degraded' | 'critical'
  latency: string
  uptime: string
}

// Default fallback data
const defaultStats: DashboardStats[] = [
  { title: 'Total Users', value: '0', trend: 0, trendLabel: 'vs last period', icon: 'i-hugeicons-user-group', iconBg: 'primary' },
  { title: 'Active Projects', value: '0', trend: 0, trendLabel: 'vs last period', icon: 'i-hugeicons-folder-02', iconBg: 'success' },
  { title: 'Cloud Uptime', value: '0%', trend: 0, trendLabel: 'vs last period', icon: 'i-hugeicons-cloud', iconBg: 'info' },
  { title: 'Response Time', value: '0ms', trend: 0, trendLabel: 'vs last period', icon: 'i-hugeicons-time-02', iconBg: 'warning' },
]

const defaultActivity: ActivityItem[] = []

const defaultHealth: SystemHealthItem[] = [
  { name: 'API', status: 'healthy', latency: '0ms', uptime: '0%' },
  { name: 'Database', status: 'healthy', latency: '0ms', uptime: '0%' },
  { name: 'Storage', status: 'healthy', latency: '0ms', uptime: '0%' },
  { name: 'Cache', status: 'healthy', latency: '0ms', uptime: '0%' },
  { name: 'Queue', status: 'healthy', latency: '0ms', uptime: '0%' },
  { name: 'Notifications', status: 'healthy', latency: '0ms', uptime: '0%' },
]

export function useDashboard() {
  const stats = ref<DashboardStats[]>(defaultStats)
  const recentActivity = ref<ActivityItem[]>(defaultActivity)
  const systemHealth = ref<SystemHealthItem[]>(defaultHealth)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDashboardStats(timeRange = '7d') {
    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(`${baseUrl}/api/dashboard/stats?range=${timeRange}`, {
        headers: {
          'Accept': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        stats.value = data.stats || defaultStats
      }
    } catch (e) {
      console.error('Failed to fetch dashboard stats:', e)
      // Keep default/fallback data
    } finally {
      isLoading.value = false
    }
  }

  async function fetchRecentActivity() {
    try {
      const response = await fetch(`${baseUrl}/api/dashboard/activity`, {
        headers: {
          'Accept': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        recentActivity.value = data.activity || defaultActivity
      }
    } catch (e) {
      console.error('Failed to fetch recent activity:', e)
    }
  }

  async function fetchSystemHealth() {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        headers: {
          'Accept': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        systemHealth.value = data.services || defaultHealth
      }
    } catch (e) {
      console.error('Failed to fetch system health:', e)
    }
  }

  async function fetchAll(timeRange = '7d') {
    isLoading.value = true
    await Promise.all([
      fetchDashboardStats(timeRange),
      fetchRecentActivity(),
      fetchSystemHealth(),
    ])
    isLoading.value = false
  }

  return {
    stats,
    recentActivity,
    systemHealth,
    isLoading,
    error,
    fetchDashboardStats,
    fetchRecentActivity,
    fetchSystemHealth,
    fetchAll,
  }
}
