import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'DeviceAnalyticsAction',
  description: 'Returns device and OS analytics data from ts-analytics.',
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

      const [deviceCmd, osCmd] = await Promise.all([
        store.getDeviceStatsCommand('default', period, periodStart, 'device'),
        store.getDeviceStatsCommand('default', period, periodStart, 'os'),
      ])

      const deviceResult = (deviceCmd as unknown as { Items?: unknown[] })?.Items ?? []
      const osResult = (osCmd as unknown as { Items?: unknown[] })?.Items ?? []

      const totalDeviceVisitors = (deviceResult as any[]).reduce((sum: number, d: any) => sum + (d.visitors || 0), 0)
      const totalOsVisitors = (osResult as any[]).reduce((sum: number, d: any) => sum + (d.visitors || 0), 0)

      const devices = AnalyticsQueryAPI.processTopDevices(
        deviceResult as Parameters<typeof AnalyticsQueryAPI.processTopDevices>[0],
        'device',
        totalDeviceVisitors,
      )

      const osStats = AnalyticsQueryAPI.processTopDevices(
        osResult as Parameters<typeof AnalyticsQueryAPI.processTopDevices>[0],
        'os',
        totalOsVisitors,
      )

      return {
        devices: devices.map(d => ({
          name: d.name,
          sessions: d.value,
          percentage: Math.round(d.percentage * 10) / 10,
        })),
        os: osStats.map(o => ({
          name: o.name,
          sessions: o.value,
          percentage: Math.round(o.percentage * 10) / 10,
        })),
      }
    }
    catch {
      return { devices: [], os: [] }
    }
  },
})
