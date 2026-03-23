/**
 * Analytics Composable
 *
 * Provides data fetching for analytics dashboard pages.
 */

import { ref } from '@stacksjs/stx'

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3008'

export interface AnalyticsOverview {
  totalVisitors: string
  totalPageViews: string
  avgSessionDuration: string
  bounceRate: string
  trends: {
    visitors: number
    pageViews: number
    sessionDuration: number
    bounceRate: number
  }
}

export interface TrafficDataPoint {
  date: string
  visitors: number
  pageViews: number
}

const defaultOverview: AnalyticsOverview = {
  totalVisitors: '0',
  totalPageViews: '0',
  avgSessionDuration: '0s',
  bounceRate: '0%',
  trends: {
    visitors: 0,
    pageViews: 0,
    sessionDuration: 0,
    bounceRate: 0,
  },
}

export function useAnalytics() {
  const overview = ref<AnalyticsOverview>(defaultOverview)
  const trafficData = ref<TrafficDataPoint[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchOverview(dateRange = '7d') {
    try {
      const response = await fetch(`${baseUrl}/analytics/overview?range=${dateRange}`, {
        headers: { 'Accept': 'application/json' },
      })

      if (response.ok) {
        const data = await response.json()
        overview.value = data.overview || defaultOverview
      }
    }
    catch (e) {
      console.error('Failed to fetch analytics overview:', e)
      throw e
    }
  }

  async function fetchTraffic(dateRange = '7d') {
    try {
      const response = await fetch(`${baseUrl}/analytics/traffic?range=${dateRange}`, {
        headers: { 'Accept': 'application/json' },
      })

      if (response.ok) {
        const data = await response.json()
        trafficData.value = data.traffic || []
      }
    }
    catch (e) {
      console.error('Failed to fetch traffic data:', e)
      throw e
    }
  }

  async function fetchAll(dateRange = '7d') {
    isLoading.value = true
    error.value = null

    try {
      await Promise.all([
        fetchOverview(dateRange),
        fetchTraffic(dateRange),
      ])
    }
    catch (e) {
      error.value = 'Failed to load analytics data.'
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    overview,
    trafficData,
    isLoading,
    error,
    fetchOverview,
    fetchTraffic,
    fetchAll,
  }
}
