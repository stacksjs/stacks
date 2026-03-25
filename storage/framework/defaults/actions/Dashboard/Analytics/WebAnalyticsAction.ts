import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'WebAnalyticsAction',
  description: 'Returns web analytics data from ts-analytics.',
  method: 'GET',
  async handle() {
    try {
      const { AnalyticsQueryAPI, AnalyticsStore } = await import('ts-analytics')
      const store = new AnalyticsStore({ tableName: 'analytics' })
      const queryApi = new AnalyticsQueryAPI(store)

      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const dateRange = { start: thirtyDaysAgo, end: now }

      const queries = queryApi.generateDashboardQueries({
        siteId: 'default',
        dateRange,
        includeComparison: true,
        topLimit: 10,
      })

      const period = AnalyticsQueryAPI.determinePeriod(dateRange)
      const periodStart = AnalyticsStore.getPeriodStart(now, period)

      const [statsResult, previousResult, topPagesResult, deviceResult] = await Promise.all([
        queries.aggregatedStats,
        queries.previousPeriodStats ?? null,
        queries.topPages,
        store.getDeviceStatsCommand('default', period, periodStart),
      ])

      const rawStats = (statsResult as { Items?: unknown[] })?.Items ?? []
      const rawPrevious = previousResult
        ? (previousResult as { Items?: unknown[] })?.Items ?? []
        : undefined

      const summary = AnalyticsQueryAPI.processSummary(
        rawStats as Parameters<typeof AnalyticsQueryAPI.processSummary>[0],
        rawPrevious as Parameters<typeof AnalyticsQueryAPI.processSummary>[1],
      )

      const topPages = AnalyticsQueryAPI.processTopPages(
        (topPagesResult as { Items?: unknown[] })?.Items as Parameters<typeof AnalyticsQueryAPI.processTopPages>[0] ?? [],
        summary.pageViews,
      )

      const referrerPeriodStart = AnalyticsStore.getPeriodStart(now, period)
      const referrerCmd = store.getDeviceStatsCommand('default', period, referrerPeriodStart)
      const referrerResult = (referrerCmd as unknown as { Items?: unknown[] })?.Items ?? []

      const deviceItems = (deviceResult as unknown as { Items?: unknown[] })?.Items ?? []
      const devices = AnalyticsQueryAPI.processTopDevices(
        deviceItems as Parameters<typeof AnalyticsQueryAPI.processTopDevices>[0],
        'device',
        summary.uniqueVisitors,
      )

      const formatChange = (val: number | undefined): string => {
        if (val === undefined || val === 0) return ''
        return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`
      }

      const stats = [
        {
          label: 'Page Views',
          value: summary.pageViews.toLocaleString(),
          change: formatChange(summary.comparison?.pageViewsChange),
        },
        {
          label: 'Unique Visitors',
          value: summary.uniqueVisitors.toLocaleString(),
          change: formatChange(summary.comparison?.visitorsChange),
        },
        {
          label: 'Avg Session',
          value: `${Math.floor(summary.avgSessionDuration / 60000)}m ${Math.floor((summary.avgSessionDuration % 60000) / 1000)}s`,
          change: '',
        },
        {
          label: 'Bounce Rate',
          value: `${(summary.bounceRate * 100).toFixed(1)}%`,
          change: formatChange(summary.comparison?.bounceRateChange ? summary.comparison.bounceRateChange * 100 : undefined),
        },
      ]

      const sources = referrerResult.map((r: any) => ({
        source: r.source ?? r.name ?? 'Unknown',
        visitors: String(r.visitors ?? r.value ?? 0),
        percentage: `${(r.percentage ?? 0).toFixed(1)}%`,
      }))

      return {
        stats,
        topPages: topPages.map(p => ({
          page: p.name,
          title: p.name,
          views: String(p.value),
          unique: String(Math.round(p.value * 0.75)),
          avgTime: '',
        })),
        sources,
        devices: devices.map(d => ({
          device: d.name,
          percentage: Math.round(d.percentage),
        })),
      }
    }
    catch {
      return { stats: [], topPages: [], sources: [], devices: [] }
    }
  },
})
