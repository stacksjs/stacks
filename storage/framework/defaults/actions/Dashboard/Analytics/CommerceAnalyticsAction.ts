import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CommerceAnalyticsAction',
  description: 'Returns commerce analytics data from ts-analytics event stats.',
  method: 'GET',
  async handle() {
    try {
      const { AnalyticsQueryAPI, AnalyticsStore } = await import('ts-analytics')
      const store = new AnalyticsStore({ tableName: 'analytics' })

      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const dateRange = { start: thirtyDaysAgo, end: now }
      const period = AnalyticsQueryAPI.determinePeriod(dateRange)
      const periodStart = AnalyticsStore.getPeriodStart(now, period)

      const eventStatsCmd = store.getEventStatsCommand('default', period, periodStart)
      const eventStatsResult = (eventStatsCmd as unknown as { Items?: unknown[] })?.Items ?? []

      // Filter for commerce-related events
      const commerceEvents = (eventStatsResult as any[]).filter((e: any) =>
        ['purchase', 'add_to_cart', 'checkout', 'order_completed', 'product_view'].includes(e.eventName),
      )

      const purchaseEvents = commerceEvents.filter((e: any) => e.eventName === 'purchase' || e.eventName === 'order_completed')
      const totalRevenue = purchaseEvents.reduce((sum: number, e: any) => sum + (e.totalValue || 0), 0)
      const orderCount = purchaseEvents.reduce((sum: number, e: any) => sum + (e.count || 0), 0)
      const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0

      const addToCartEvents = commerceEvents.filter((e: any) => e.eventName === 'add_to_cart')
      const cartCount = addToCartEvents.reduce((sum: number, e: any) => sum + (e.count || 0), 0)
      const conversionRate = cartCount > 0 ? (orderCount / cartCount) * 100 : 0

      const stats = [
        { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, change: '' },
        { label: 'Orders', value: orderCount.toLocaleString(), change: '' },
        { label: 'Avg Order Value', value: `$${avgOrderValue.toFixed(2)}`, change: '' },
        { label: 'Conversion Rate', value: `${conversionRate.toFixed(1)}%`, change: '' },
      ]

      const topProducts = commerceEvents
        .filter((e: any) => e.eventName === 'purchase' || e.eventName === 'order_completed')
        .sort((a: any, b: any) => (b.totalValue || 0) - (a.totalValue || 0))
        .slice(0, 5)
        .map((e: any) => ({
          name: e.eventName,
          revenue: `$${(e.totalValue || 0).toLocaleString()}`,
          units: e.count || 0,
          growth: '',
        }))

      return {
        stats,
        topProducts,
        salesByRegion: [],
        revenueByChannel: [],
      }
    }
    catch {
      return { stats: [], topProducts: [], salesByRegion: [], revenueByChannel: [] }
    }
  },
})
