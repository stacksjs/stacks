/**
 * Aggregator helpers for the Analytics dashboard pages. Each function
 * pulls from the seeded `Activity` / `Request` / `Order` / `Subscriber`
 * tables and reduces to the chart-ready shape the page expects.
 *
 * No model is required to exist — the helpers fall back to empty data
 * when the table or column is missing, so analytics pages still render
 * without errors on an unseeded database.
 */

import { countBy, groupByDay, loadModel, safeAll, safeGet, sumByDay, topN } from './data'

export interface WebMetrics {
  totalRequests: number
  uniqueVisitors: number
  avgResponseTime: number
  errorRate: number
  perDay: Array<{ date: string, count: number }>
}

/**
 * Site-traffic aggregations from the `Request` model. Unique visitors
 * are counted by distinct IP; response time / error rate read the
 * `duration_ms` and `status_code` columns the seeder populates.
 */
export async function getWebMetrics(days = 30): Promise<WebMetrics> {
  const Request = await loadModel('Request')
  const rows = await safeAll(Request)
  const ips = new Set<string>()
  let totalDuration = 0
  let durationSamples = 0
  let errors = 0
  for (const r of rows) {
    const ip = String(safeGet(r, 'ip_address', '') || safeGet(r, 'ip', ''))
    if (ip) ips.add(ip)
    const dur = Number(safeGet(r, 'duration_ms', 0)) || Number(safeGet(r, 'duration', 0))
    if (dur > 0) {
      totalDuration += dur
      durationSamples++
    }
    const status = Number(safeGet(r, 'status_code', 0)) || Number(safeGet(r, 'status', 0))
    if (status >= 400) errors++
  }
  return {
    totalRequests: rows.length,
    uniqueVisitors: ips.size,
    avgResponseTime: durationSamples > 0 ? Math.round(totalDuration / durationSamples) : 0,
    errorRate: rows.length > 0 ? Math.round((errors / rows.length) * 1000) / 10 : 0,
    perDay: groupByDay(rows, 'created_at', days),
  }
}

/** Top referrer hosts. */
export async function getTopReferrers(n = 10): Promise<Array<{ value: string, count: number }>> {
  const Request = await loadModel('Request')
  const rows = await safeAll(Request)
  return topN(rows, 'referrer', n)
}

/** Visitor breakdown by user-agent family (best-effort). */
export async function getBrowserBreakdown(): Promise<Array<{ value: string, count: number }>> {
  const Request = await loadModel('Request')
  const rows = await safeAll(Request)
  const counts: Record<string, number> = {}
  for (const r of rows) {
    const ua = String(safeGet(r, 'user_agent', '') || safeGet(r, 'browser', ''))
    const fam = parseBrowser(ua)
    counts[fam] = (counts[fam] || 0) + 1
  }
  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
}

/** Visitor breakdown by device type (mobile/tablet/desktop). */
export async function getDeviceBreakdown(): Promise<Array<{ value: string, count: number }>> {
  const Request = await loadModel('Request')
  const rows = await safeAll(Request)
  const counts: Record<string, number> = { desktop: 0, mobile: 0, tablet: 0, other: 0 }
  for (const r of rows) {
    const ua = String(safeGet(r, 'user_agent', '') || safeGet(r, 'device', '')).toLowerCase()
    if (/tablet|ipad/.test(ua)) counts.tablet++
    else if (/mobile|iphone|android/.test(ua)) counts.mobile++
    else if (ua) counts.desktop++
    else counts.other++
  }
  return Object.entries(counts)
    .filter(([, c]) => c > 0)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
}

/** Visitor breakdown by country, using an explicit `country` column. */
export async function getCountryBreakdown(n = 10): Promise<Array<{ value: string, count: number }>> {
  const Request = await loadModel('Request')
  const rows = await safeAll(Request)
  return topN(rows, 'country', n)
}

/** Top page paths by request count. */
export async function getTopPages(n = 10): Promise<Array<{ value: string, count: number }>> {
  const Request = await loadModel('Request')
  const rows = await safeAll(Request)
  return topN(rows, 'path', n)
}

export interface SalesTimeSeries {
  perDay: Array<{ date: string, total: number }>
  totalRevenue: number
  orderCount: number
  avgOrderValue: number
}

/**
 * Revenue-per-day plus rollups, derived from the `Order` model.
 * Falls back to zero values if the model isn't loaded.
 */
export async function getSalesTimeSeries(days = 30): Promise<SalesTimeSeries> {
  const Order = await loadModel('Order')
  const rows = await safeAll(Order)
  let totalRevenue = 0
  for (const r of rows) {
    totalRevenue += Number(safeGet(r, 'total_amount', 0)) || Number(safeGet(r, 'amount', 0)) || 0
  }
  return {
    perDay: sumByDay(rows, 'created_at', 'total_amount', days),
    totalRevenue,
    orderCount: rows.length,
    avgOrderValue: rows.length > 0 ? totalRevenue / rows.length : 0,
  }
}

/** Top-selling products by occurrence in OrderItems. */
export async function getTopProducts(n = 5): Promise<Array<{ value: string, count: number }>> {
  const OrderItem = await loadModel('OrderItem')
  const rows = await safeAll(OrderItem)
  return topN(rows, 'product_name', n)
}

/** Top customers by order count. */
export async function getTopCustomers(n = 5): Promise<Array<{ value: string, count: number }>> {
  const Order = await loadModel('Order')
  const rows = await safeAll(Order)
  return topN(rows, 'customer_name', n)
}

export interface MarketingMetrics {
  campaignCount: number
  listCount: number
  subscriberCount: number
  socialPostCount: number
  reviewCount: number
  campaignsByStatus: Record<string, number>
  subscribersPerDay: Array<{ date: string, count: number }>
}

export async function getMarketingMetrics(days = 30): Promise<MarketingMetrics> {
  const [Campaign, EmailList, Subscriber, SocialPost, Review] = await Promise.all([
    loadModel('Campaign'),
    loadModel('EmailList'),
    loadModel('Subscriber'),
    loadModel('SocialPost'),
    loadModel('Review'),
  ])
  const [campaigns, lists, subscribers, posts, reviews] = await Promise.all([
    safeAll(Campaign),
    safeAll(EmailList),
    safeAll(Subscriber),
    safeAll(SocialPost),
    safeAll(Review),
  ])
  return {
    campaignCount: campaigns.length,
    listCount: lists.length,
    subscriberCount: subscribers.length,
    socialPostCount: posts.length,
    reviewCount: reviews.length,
    campaignsByStatus: countBy(campaigns, 'status'),
    subscribersPerDay: groupByDay(subscribers, 'created_at', days),
  }
}

/** Goal/event tracking from the Activity model. */
export async function getEventStats(): Promise<{
  total: number
  byEvent: Record<string, number>
  perDay: Array<{ date: string, count: number }>
}> {
  const Activity = await loadModel('Activity')
  const rows = await safeAll(Activity)
  return {
    total: rows.length,
    byEvent: countBy(rows, 'event'),
    perDay: groupByDay(rows, 'created_at', 30),
  }
}

/** Blog-content metrics — uses Post + Comment + Tag models. */
export async function getBlogMetrics(): Promise<{
  postCount: number
  publishedCount: number
  draftCount: number
  totalViews: number
  totalComments: number
  postsPerDay: Array<{ date: string, count: number }>
}> {
  const [Post, Comment] = await Promise.all([loadModel('Post'), loadModel('Comment')])
  const [posts, comments] = await Promise.all([safeAll(Post), safeAll(Comment)])
  let totalViews = 0
  let publishedCount = 0
  let draftCount = 0
  for (const p of posts) {
    totalViews += Number(safeGet(p, 'views', 0)) || 0
    const status = String(safeGet(p, 'status', '')).toLowerCase()
    if (status === 'published') publishedCount++
    else if (status === 'draft') draftCount++
  }
  return {
    postCount: posts.length,
    publishedCount,
    draftCount,
    totalViews,
    totalComments: comments.length,
    postsPerDay: groupByDay(posts, 'created_at', 30),
  }
}

/** Cheap heuristic to bucket a UA string into a browser family. */
function parseBrowser(ua: string): string {
  if (!ua) return 'unknown'
  const u = ua.toLowerCase()
  if (u.includes('edg/')) return 'Edge'
  if (u.includes('opr/') || u.includes('opera')) return 'Opera'
  if (u.includes('chrome')) return 'Chrome'
  if (u.includes('safari') && !u.includes('chrome')) return 'Safari'
  if (u.includes('firefox')) return 'Firefox'
  return 'Other'
}
