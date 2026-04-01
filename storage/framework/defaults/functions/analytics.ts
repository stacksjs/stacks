/**
 * Analytics Composable
 */
import { ref } from '@stacksjs/stx'

const baseUrl = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

export interface AnalyticsOverview {
  realtime: number
  people: number
  views: number
  avgTimeOnSite: string
  bounceRate: string
  eventCompletions: number
}

export interface TrafficDataPoint {
  date: string
  visitors: number
  pageViews: number
}

export interface PageData {
  path: string
  entries: number
  visitors: number
  views: number
  percentage: number
}

export interface ReferrerData {
  name: string
  visitors: number
  views: number
  percentage: number
}

export interface DeviceData {
  name: string
  visitors: number
  percentage: number
}

export interface BrowserData {
  name: string
  visitors: number
  percentage: number
}

export interface CountryData {
  name: string
  visitors: number
  percentage: number
  flag: string
}

export function useAnalytics() {
  const overview = ref<AnalyticsOverview>({ realtime: 0, people: 0, views: 0, avgTimeOnSite: '0s', bounceRate: '0%', eventCompletions: 0 })
  const trafficData = ref<TrafficDataPoint[]>([])
  const pagesData = ref<PageData[]>([])
  const referrersData = ref<ReferrerData[]>([])
  const devicesData = ref<DeviceData[]>([])
  const browsersData = ref<BrowserData[]>([])
  const countriesData = ref<CountryData[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(dateRange = '7d') {
    isLoading.value = true
    error.value = null
    try {
      const response = await fetch(`${baseUrl}/analytics/web?range=${dateRange}`, {
        headers: { 'Accept': 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        overview.value = data.overview || overview.value
        trafficData.value = data.traffic || []
        pagesData.value = data.pages || []
        referrersData.value = data.referrers || []
        devicesData.value = data.devices || []
        browsersData.value = data.browsers || []
        countriesData.value = data.countries || []
      }
    } catch (e) {
      error.value = 'Failed to load analytics data.'
      console.error('Failed to fetch analytics:', e)
    } finally {
      isLoading.value = false
    }
  }

  return {
    overview, trafficData, pagesData, referrersData, devicesData, browsersData, countriesData,
    isLoading, error, fetchAll,
  }
}
