export type AnalyticsRange = 'day' | 'week' | 'month' | 'year'
export type AnalyticsScope = 'all' | 'blog' | 'commerce'

export interface RequestAnalyticsRow {
  method: string
  path: string
  statusCode: number
  durationMs: number
  ipAddress: string
  userAgent: string
  createdAt: string
}

interface TrafficBucket {
  date: string
  pageViews: number
  visitors: number
}

const RANGE_DAYS: Record<AnalyticsRange, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
}

const SCOPE_PREFIXES: Record<Exclude<AnalyticsScope, 'all'>, string[]> = {
  blog: ['/blog'],
  commerce: ['/commerce', '/products', '/product', '/cart', '/checkout', '/orders'],
}

export function normalizeAnalyticsRange(value: unknown): AnalyticsRange {
  const range = String(value || '').toLowerCase()
  return ['day', 'week', 'month', 'year'].includes(range)
    ? range as AnalyticsRange
    : 'month'
}

export function normalizeAnalyticsScope(value: unknown): AnalyticsScope {
  const scope = String(value || '').toLowerCase()
  return ['blog', 'commerce'].includes(scope)
    ? scope as AnalyticsScope
    : 'all'
}

function timestamp(value: string): number {
  if (!value)
    return Number.NaN
  const normalized = /^\d{4}-\d{2}-\d{2} \d/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value
  return new Date(normalized).getTime()
}

function pagePath(value: string): string {
  try {
    return new URL(value, 'http://stacks.local').pathname || '/'
  }
  catch {
    return value.startsWith('/') ? value : `/${value}`
  }
}

function isPageRequest(row: RequestAnalyticsRow): boolean {
  const path = pagePath(row.path)
  return row.method.toUpperCase() === 'GET'
    && row.statusCode < 400
    && !path.startsWith('/api/')
    && !path.startsWith('/__')
    && !/\.(?:css|js|map|png|jpe?g|gif|svg|ico|woff2?|ttf)$/i.test(path)
}

function matchesScope(row: RequestAnalyticsRow, scope: AnalyticsScope): boolean {
  if (scope === 'all')
    return true
  const path = pagePath(row.path)
  return SCOPE_PREFIXES[scope].some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

function browserName(userAgent: string): string {
  if (/Edg\//i.test(userAgent)) return 'Edge'
  if (/Firefox\//i.test(userAgent)) return 'Firefox'
  if (/Chrome\//i.test(userAgent)) return 'Chrome'
  if (/Safari\//i.test(userAgent)) return 'Safari'
  return userAgent ? 'Other' : 'Unknown'
}

function deviceName(userAgent: string): string {
  if (/iPad|Tablet/i.test(userAgent)) return 'Tablet'
  if (/Mobile|Android|iPhone/i.test(userAgent)) return 'Phone'
  return userAgent ? 'Desktop' : 'Unknown'
}

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0
}

function dateKey(time: number, range: AnalyticsRange): string {
  const date = new Date(time)
  if (range === 'day')
    return `${String(date.getUTCHours()).padStart(2, '0')}:00`
  if (range === 'year')
    return date.toISOString().slice(0, 7)
  return date.toISOString().slice(0, 10)
}

function trafficSeries(rows: RequestAnalyticsRow[], range: AnalyticsRange): TrafficBucket[] {
  const buckets = new Map<string, { pageViews: number, visitors: Set<string> }>()
  for (const row of rows) {
    const key = dateKey(timestamp(row.createdAt), range)
    const bucket = buckets.get(key) || { pageViews: 0, visitors: new Set<string>() }
    bucket.pageViews++
    if (row.ipAddress)
      bucket.visitors.add(row.ipAddress)
    buckets.set(key, bucket)
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, bucket]) => ({
      date,
      pageViews: bucket.pageViews,
      visitors: bucket.visitors.size,
    }))
}

function groupedBreakdown(
  rows: RequestAnalyticsRow[],
  keyFor: (row: RequestAnalyticsRow) => string,
): Array<{ name: string, visitors: number, percentage: number }> {
  const groups = new Map<string, Set<string>>()
  for (const row of rows) {
    const key = keyFor(row)
    const visitors = groups.get(key) || new Set<string>()
    if (row.ipAddress)
      visitors.add(row.ipAddress)
    groups.set(key, visitors)
  }
  const total = [...groups.values()].reduce((sum, visitors) => sum + visitors.size, 0)

  return [...groups.entries()]
    .map(([name, visitors]) => ({
      name,
      visitors: visitors.size,
      percentage: percentage(visitors.size, total),
    }))
    .sort((left, right) => right.visitors - left.visitors)
}

export function buildWebAnalytics(
  allRows: RequestAnalyticsRow[],
  range: AnalyticsRange,
  now = new Date(),
  scope: AnalyticsScope = 'all',
) {
  const start = new Date(now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000)
  const rows = allRows.filter(row =>
    timestamp(row.createdAt) >= start.getTime()
    && timestamp(row.createdAt) <= now.getTime()
    && matchesScope(row, scope),
  )
  const pages = rows.filter(isPageRequest)
  const visitors = new Set(pages.map(row => row.ipAddress).filter(Boolean))
  const errors = rows.filter(row => row.statusCode >= 400).length
  const successful = rows.filter(row => row.statusCode > 0 && row.statusCode < 400).length
  const durationSamples = rows.map(row => row.durationMs).filter(value => value > 0)
  const averageDuration = durationSamples.length > 0
    ? Math.round(durationSamples.reduce((sum, value) => sum + value, 0) / durationSamples.length)
    : 0

  const pageGroups = new Map<string, { views: number, visitors: Set<string> }>()
  for (const row of pages) {
    const path = pagePath(row.path)
    const page = pageGroups.get(path) || { views: 0, visitors: new Set<string>() }
    page.views++
    if (row.ipAddress)
      page.visitors.add(row.ipAddress)
    pageGroups.set(path, page)
  }

  const pageData = [...pageGroups.entries()]
    .map(([path, page]) => ({
      path,
      entries: page.views,
      visitors: page.visitors.size,
      views: page.views,
      percentage: percentage(page.views, pages.length),
    }))
    .sort((left, right) => right.views - left.views)
    .slice(0, 10)

  const realtimeStart = now.getTime() - 5 * 60 * 1000
  const realtime = new Set(pages.filter(row => timestamp(row.createdAt) >= realtimeStart).map(row => row.ipAddress).filter(Boolean)).size

  return {
    source: 'requests',
    range,
    scope,
    dateRange: {
      start: start.toISOString(),
      end: now.toISOString(),
    },
    overview: {
      realtime,
      people: visitors.size,
      views: pages.length,
      avgTimeOnSite: averageDuration > 0 ? `${averageDuration} ms` : '-',
      bounceRate: rows.length > 0 ? `${percentage(errors, rows.length)}%` : '0%',
      eventCompletions: successful,
    },
    traffic: trafficSeries(pages, range),
    pages: pageData,
    referrers: [],
    devices: groupedBreakdown(pages, row => deviceName(row.userAgent)),
    browsers: groupedBreakdown(pages, row => browserName(row.userAgent)),
    countries: [],
  }
}
