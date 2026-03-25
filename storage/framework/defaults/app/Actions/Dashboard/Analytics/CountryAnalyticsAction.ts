import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CountryAnalyticsAction',
  description: 'Returns country analytics data from ts-analytics geo stats.',
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

      const geoStatsCmd = store.getGeoStatsCommand('default', period, periodStart, 20)
      const geoResult = (geoStatsCmd as unknown as { Items?: unknown[] })?.Items ?? []

      const totalVisitors = (geoResult as any[]).reduce((sum: number, g: any) => sum + (g.visitors || 0), 0)

      const countries = AnalyticsQueryAPI.processTopCountries(
        geoResult as Parameters<typeof AnalyticsQueryAPI.processTopCountries>[0],
        totalVisitors,
      )

      return {
        countries: countries.map(c => ({
          name: c.name,
          visitors: c.value,
          percentage: Math.round(c.percentage * 10) / 10,
          flag: c.name,
        })),
      }
    }
    catch {
      return { countries: [] }
    }
  },
})
