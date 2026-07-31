/**
 * Analytics Composable
 */
import { ref } from '@stacksjs/stx'
import { dashboardApi } from './dashboard-api'

export interface AnalyticsOverview {
  realtimeVisitors: number
  uniqueVisitors: number
  pageViews: number
  averageResponseTime: string
  errorRate: string
  successfulRequests: number
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
    audience: number | null
    sent: number | null
    opens: number | null
    clicks: number | null
    conversions: number | null
    openRate: number | null
    clickRate: number | null
    conversionRate: number | null
  }
  spendByCurrency: Array<{
    currency: string
    budget: number | null
    spent: number | null
    campaigns: number
  }>
  campaigns: Array<{
    id: string
    name: string
    type: string
    status: string
    audienceSize: number | null
    sentCount: number | null
    openRate: number | null
    clickRate: number | null
    conversionRate: number | null
    budget: number | null
    spent: number | null
    currency: string
    createdAt: string
    opens: number | null
    clicks: number | null
    conversions: number | null
  }>
  channels: Array<{
    type: string
    name: string
    currency: string
    campaigns: number
    audience: number | null
    sent: number | null
    spent: number | null
    openRate: number | null
    clickRate: number | null
    conversionRate: number | null
  }>
  statuses: Array<{
    status: string
    label: string
    count: number
  }>
}

export interface EventAnalyticsResponse {
  source: 'analytics-events'
  range: AnalyticsRange
  dateRange: {
    start: string
    end: string
  }
  overview: {
    occurrences: number
    eventNames: number
    categories: number
    valuedEvents: number
  }
  events: Array<{
    name: string
    category: string
    currency: string
    count: number
    value: number
    lastSeen: string
  }>
  categories: Array<{
    name: string
    label: string
    count: number
    percentage: number
  }>
  valueByCurrency: Array<{
    currency: string
    value: number
    events: number
  }>
  timeline: Array<{
    date: string
    count: number
  }>
  recent: Array<{
    id: string
    name: string
    category: string
    path: string
    value: number
    currency: string
    createdAt: string
  }>
}

export interface RecordAnalyticsEventInput {
  name: string
  category?: string
  path?: string
  value?: number
  currency?: string
  properties?: unknown
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

export async function fetchEventAnalytics(range: AnalyticsRange = 'month'): Promise<EventAnalyticsResponse> {
  return await dashboardApi<EventAnalyticsResponse>(`/api/dashboard/event-metrics?range=${encodeURIComponent(range)}`)
}

export async function recordAnalyticsEvent(input: RecordAnalyticsEventInput): Promise<{ success: true }> {
  return await dashboardApi<{ success: true }>('/api/dashboard/event-metrics', {
    method: 'POST',
    body: input,
  })
}

export function useAnalytics() {
  const overview = ref<AnalyticsOverview>({
    realtimeVisitors: 0,
    uniqueVisitors: 0,
    pageViews: 0,
    averageResponseTime: '-',
    errorRate: 'N/A',
    successfulRequests: 0,
  })
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
