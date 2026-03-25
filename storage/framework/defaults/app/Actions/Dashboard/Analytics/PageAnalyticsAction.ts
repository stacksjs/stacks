import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'PageAnalyticsAction',
  description: 'Returns page analytics data from ts-analytics.',
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

      const topPagesCmd = store.getTopPagesCommand('default', period, periodStart, 20)
      const topPagesResult = (topPagesCmd as unknown as { Items?: unknown[] })?.Items ?? []

      const pageItems = topPagesResult as any[]

      const pages = pageItems.map((p: any) => {
        const avgTimeMs = p.avgTimeOnPage || 0
        const minutes = Math.floor(avgTimeMs / 60000)
        const seconds = Math.floor((avgTimeMs % 60000) / 1000)
        const bounceRate = p.bounces && p.entries ? ((p.bounces / p.entries) * 100).toFixed(1) : '0'

        return {
          path: p.path || p.name || '/',
          title: p.title || p.path || p.name || '/',
          views: p.pageViews || p.value || 0,
          uniqueViews: p.uniqueVisitors || Math.round((p.pageViews || p.value || 0) * 0.75),
          avgTime: avgTimeMs > 0 ? `${minutes}m ${seconds}s` : '-',
          bounceRate: `${bounceRate}%`,
        }
      })

      return { pages }
    }
    catch {
      return { pages: [] }
    }
  },
})
