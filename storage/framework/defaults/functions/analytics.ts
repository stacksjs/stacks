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
export type AnalyticsScope = 'all' | 'blog' | 'commerce'

export interface WebAnalyticsResponse {
  source: 'requests'
  range: AnalyticsRange
  scope: AnalyticsScope
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

export interface SalesAnalyticsResponse {
  source: 'models'
  range: AnalyticsRange
  dateRange: {
    start: string
    end: string
  }
  overview: {
    orders: number
    payments: number
    refunds: number
    currencies: number
  }
  currencyTotals: Array<{
    currency: string
    orders: number
    gross: number
    cancelled: number
    net: number
    average: number
  }>
  paymentMethods: Array<{
    method: string
    currency: string
    amount: number
    refunds: number
    net: number
    transactions: number
    percentage: number
  }>
  dailyOrders: Array<{
    date: string
    currency: string
    value: number
    orders: number
  }>
  topProducts: Array<{
    id: string
    productId: string
    name: string
    categoryId: string
    quantity: number
    revenue: number
    currency: string
  }>
  categories: Array<{
    id: string
    categoryId: string
    name: string
    quantity: number
    revenue: number
    currency: string
  }>
}

export interface CampaignAnalyticsResponse {
  source: 'campaigns'
  range: AnalyticsRange
  dateRange: {
    start: string
    end: string
  }
  overview: {
    campaigns: number
    audience: number
    sent: number
    opens: number
    clicks: number
    conversions: number
    openRate: number
    clickRate: number
    conversionRate: number
  }
  spendByCurrency: Array<{
    currency: string
    budget: number
    spent: number
    campaigns: number
  }>
  campaigns: Array<{
    id: string
    name: string
    type: string
    status: string
    audienceSize: number
    sentCount: number
    openRate: number
    clickRate: number
    conversionRate: number
    budget: number
    spent: number
    currency: string
    createdAt: string
    opens: number
    clicks: number
    conversions: number
  }>
  channels: Array<{
    type: string
    name: string
    currency: string
    campaigns: number
    audience: number
    sent: number
    spent: number
    openRate: number
    clickRate: number
    conversionRate: number
  }>
  statuses: Array<{
    status: string
    label: string
    count: number
  }>
}

export async function fetchWebAnalytics(range: AnalyticsRange = 'month', scope: AnalyticsScope = 'all'): Promise<WebAnalyticsResponse> {
  const query = new URLSearchParams({ range, scope })
  return await dashboardApi<WebAnalyticsResponse>(`/api/dashboard/analytics/web?${query.toString()}`)
}

export async function fetchSalesAnalytics(range: AnalyticsRange = 'month'): Promise<SalesAnalyticsResponse> {
  return await dashboardApi<SalesAnalyticsResponse>(`/api/dashboard/analytics/sales?range=${encodeURIComponent(range)}`)
}

export async function fetchCampaignAnalytics(range: AnalyticsRange = 'month'): Promise<CampaignAnalyticsResponse> {
  return await dashboardApi<CampaignAnalyticsResponse>(`/api/dashboard/analytics/marketing?range=${encodeURIComponent(range)}`)
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
