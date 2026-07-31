import { ref } from '@stacksjs/stx'
import { dashboardApi } from './dashboard-api'

export interface DashboardStats {
  title: string
  value: string
  trend: number | null
  trendLabel: string
  icon: string
  iconBg: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

export interface ActivityItem {
  id: number
  type: string
  title: string
  source: string
  time: string
  status: 'success' | 'error' | 'warning' | 'info'
}

export interface SystemHealthItem {
  name: string
  status: 'healthy' | 'degraded' | 'critical'
  latency: string
  detail: string
}

export interface DashboardHttpMetric {
  title: string
  value: string
  detail: string
  icon: string
}

export interface DashboardIssue {
  source: string
  message: string
}

interface DashboardHomeResponse {
  stats?: Array<{ label: string, value: string }>
  httpMetrics?: DashboardHttpMetric[]
  services?: SystemHealthItem[]
  activities?: Array<{
    type: string
    message: string
    time: string
    user?: string
    status: ActivityItem['status']
  }>
  issues?: DashboardIssue[]
}

const statPresentation: Record<string, Pick<DashboardStats, 'icon' | 'iconBg'>> = {
  'Total Users': { icon: 'i-hugeicons-user-group', iconBg: 'primary' },
  'Products': { icon: 'i-hugeicons-package', iconBg: 'success' },
  'Revenue': { icon: 'i-hugeicons-money-03', iconBg: 'warning' },
  'Orders': { icon: 'i-hugeicons-shopping-cart-02', iconBg: 'danger' },
}

function normalizeStats(stats: DashboardHomeResponse['stats']): DashboardStats[] {
  if (!Array.isArray(stats))
    return []

  return stats.map((stat) => {
    const presentation = statPresentation[stat.label] || {
      icon: 'i-hugeicons-chart-up',
      iconBg: 'neutral' as const,
    }

    return {
      title: stat.label,
      value: stat.value,
      trend: null,
      trendLabel: 'Current total',
      ...presentation,
    }
  })
}

function normalizeActivities(activities: DashboardHomeResponse['activities']): ActivityItem[] {
  if (!Array.isArray(activities))
    return []

  return activities.map((activity, index) => ({
    id: index,
    type: activity.type,
    title: activity.message,
    source: activity.user || '',
    time: activity.time,
    status: activity.status,
  }))
}

export async function fetchDashboardHome(): Promise<DashboardHomeResponse> {
  return dashboardApi<DashboardHomeResponse>('/api/dashboard/home')
}

export function useDashboard() {
  const stats = ref<DashboardStats[]>([])
  const httpMetrics = ref<DashboardHttpMetric[]>([])
  const recentActivity = ref<ActivityItem[]>([])
  const systemHealth = ref<SystemHealthItem[]>([])
  const issues = ref<DashboardIssue[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDashboardStats(timeRange = '7d') {
    void timeRange
    const data = await fetchDashboardHome()
    stats.value = normalizeStats(data.stats)
    issues.value = Array.isArray(data.issues) ? data.issues : []
  }

  async function fetchRecentActivity() {
    const data = await fetchDashboardHome()
    recentActivity.value = normalizeActivities(data.activities)
    issues.value = Array.isArray(data.issues) ? data.issues : []
  }

  async function fetchSystemHealth() {
    const data = await fetchDashboardHome()
    systemHealth.value = Array.isArray(data.services) ? data.services : []
    issues.value = Array.isArray(data.issues) ? data.issues : []
  }

  async function fetchAll(timeRange = '7d') {
    void timeRange
    isLoading.value = true
    error.value = null

    try {
      const data = await fetchDashboardHome()
      stats.value = normalizeStats(data.stats)
      httpMetrics.value = Array.isArray(data.httpMetrics) ? data.httpMetrics : []
      recentActivity.value = normalizeActivities(data.activities)
      systemHealth.value = Array.isArray(data.services) ? data.services : []
      issues.value = Array.isArray(data.issues) ? data.issues : []
    }
    catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Dashboard data could not be loaded.'
      stats.value = []
      httpMetrics.value = []
      recentActivity.value = []
      systemHealth.value = []
      issues.value = []
      throw cause
    }
    finally {
      isLoading.value = false
    }
  }

  function retry(timeRange = '7d') {
    return fetchAll(timeRange)
  }

  return {
    stats,
    httpMetrics,
    recentActivity,
    systemHealth,
    issues,
    isLoading,
    error,
    fetchDashboardStats,
    fetchRecentActivity,
    fetchSystemHealth,
    fetchAll,
    retry,
  }
}
