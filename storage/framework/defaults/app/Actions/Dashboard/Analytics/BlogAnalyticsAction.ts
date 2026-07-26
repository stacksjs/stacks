import { Action } from '@stacksjs/actions'
import { log } from '@stacksjs/logging'

export default new Action({
  name: 'BlogAnalyticsAction',
  description: 'Returns blog analytics data from ts-analytics filtered for blog paths.',
  method: 'GET',
  async handle() {
    try {
      const { AnalyticsQueryAPI, AnalyticsStore } = await import('@ts-analytics/tracking/analytics')
      const store = new AnalyticsStore({ tableName: 'analytics' })

      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const dateRange = { start: thirtyDaysAgo, end: now }
      const period = AnalyticsQueryAPI.determinePeriod(dateRange)
      const periodStart = AnalyticsStore.getPeriodStart(now, period)

      const topPagesCmd = store.getTopPagesCommand('default', period, periodStart, 50)
      const topPagesResult = (topPagesCmd as unknown as { Items?: unknown[] })?.Items ?? []

      const allPages = AnalyticsQueryAPI.processTopPages(
        topPagesResult as Parameters<typeof AnalyticsQueryAPI.processTopPages>[0],
        1,
      )

      // Filter for blog paths
      const blogPages = allPages.filter(p => p.name.startsWith('/blog'))

      const totalViews = blogPages.reduce((sum, p) => sum + p.value, 0)
      const avgTimeOnPage = 0

      const stats = [
        { label: 'Total Views', value: totalViews.toLocaleString(), change: '' },
        { label: 'Avg Read Time', value: avgTimeOnPage > 0 ? `${Math.floor(avgTimeOnPage / 60000)}m ${Math.floor((avgTimeOnPage % 60000) / 1000)}s` : '-', change: '' },
        { label: 'Blog Posts Tracked', value: String(blogPages.length), change: '' },
        { label: 'Top Post Views', value: blogPages.length > 0 ? blogPages[0].value.toLocaleString() : '0', change: '' },
      ]

      const topPosts = blogPages.slice(0, 10).map(p => ({
        title: p.name,
        views: p.value.toLocaleString(),
        comments: 0,
        shares: 0,
        published: '',
      }))

      return {
        stats,
        topPosts,
        categories: [],
        authors: [],
      }
    }
    catch (error) {
      // The analytics integration is optional: without
      // @ts-analytics/tracking installed the dashboard renders empty
      // rather than erroring. Log so a broken install is still visible.
      log.debug('[BlogAnalyticsAction] analytics unavailable:', error)
      return { stats: [], topPosts: [], categories: [], authors: [] }
    }
  },
})
