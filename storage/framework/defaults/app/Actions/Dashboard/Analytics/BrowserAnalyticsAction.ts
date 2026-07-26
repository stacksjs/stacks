import { Action } from '@stacksjs/actions'
import { log } from '@stacksjs/logging'

export default new Action({
  name: 'BrowserAnalyticsAction',
  description: 'Returns browser analytics data from ts-analytics device stats.',
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

      const deviceStatsCmd = store.getDeviceStatsCommand('default', period, periodStart, 'browser')
      const deviceResult = (deviceStatsCmd as unknown as { Items?: unknown[] })?.Items ?? []

      const totalVisitors = (deviceResult as any[]).reduce((sum: number, d: any) => sum + (d.visitors || 0), 0)

      const browsers = AnalyticsQueryAPI.processTopDevices(
        deviceResult as Parameters<typeof AnalyticsQueryAPI.processTopDevices>[0],
        'browser',
        totalVisitors,
      )

      return {
        browsers: browsers.map(b => ({
          name: b.name,
          sessions: b.value,
          percentage: Math.round(b.percentage * 10) / 10,
          version: '',
        })),
      }
    }
    catch (error) {
      // The analytics integration is optional: without
      // @ts-analytics/tracking installed the dashboard renders empty
      // rather than erroring. Log so a broken install is still visible.
      log.debug('[BrowserAnalyticsAction] analytics unavailable:', error)
      return { browsers: [] }
    }
  },
})
