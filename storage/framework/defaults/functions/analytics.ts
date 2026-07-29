/**
 * Analytics Composable
 */
import { ref } from '@stacksjs/stx'
import { dashboardApi } from './dashboard-api'

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

export type AnalyticsRange = 'day' | 'week' | 'month' | 'year'

export interface WebAnalyticsResponse {
  source: 'requests'
  range: AnalyticsRange
  dateRange: {
    start: string
    end: string
  }
  overview: AnalyticsOverview
  traffic: TrafficDataPoint[]
  pages: PageData[]
  referrers: ReferrerData[]
  devices: DeviceData[]
  browsers: BrowserData[]
  countries: CountryData[]
}

export async function fetchWebAnalytics(range: AnalyticsRange = 'month'): Promise<WebAnalyticsResponse> {
  return await dashboardApi<WebAnalyticsResponse>(`/api/dashboard/analytics/web?range=${encodeURIComponent(range)}`)
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
      const range: AnalyticsRange = dateRange === '1d'
        ? 'day'
        : dateRange === '7d'
          ? 'week'
          : dateRange === '1y'
            ? 'year'
            : 'month'
      const data = await fetchWebAnalytics(range)
      overview.value = data.overview
      trafficData.value = data.traffic
      pagesData.value = data.pages
      referrersData.value = data.referrers
      devicesData.value = data.devices
      browsersData.value = data.browsers
      countriesData.value = data.countries
    }
    catch {
      error.value = 'Failed to load analytics data.'
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    overview, trafficData, pagesData, referrersData, devicesData, browsersData, countriesData,
    isLoading, error, fetchAll,
  }
}
