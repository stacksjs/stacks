import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'MarketingAnalyticsAction',
  description: 'Returns marketing analytics data from ts-analytics campaign and referrer stats.',
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

      const campaignStatsCmd = store.getCampaignStatsCommand('default', period, periodStart)
      const campaignResult = (campaignStatsCmd as unknown as { Items?: unknown[] })?.Items ?? []

      const campaignItems = campaignResult as any[]

      const totalVisitors = campaignItems.reduce((sum: number, c: any) => sum + (c.visitors || 0), 0)
      const totalConversions = campaignItems.reduce((sum: number, c: any) => sum + (c.conversions || 0), 0)
      const totalRevenue = campaignItems.reduce((sum: number, c: any) => sum + (c.revenue || 0), 0)

      const stats = [
        { label: 'Campaign Visitors', value: totalVisitors.toLocaleString(), change: '' },
        { label: 'Conversions', value: totalConversions.toLocaleString(), change: '' },
        { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, change: '' },
        { label: 'Avg Conversion Rate', value: totalVisitors > 0 ? `${((totalConversions / totalVisitors) * 100).toFixed(1)}%` : '0%', change: '' },
      ]

      const campaigns = campaignItems
        .sort((a: any, b: any) => (b.revenue || 0) - (a.revenue || 0))
        .slice(0, 10)
        .map((c: any) => ({
          name: [c.utmSource, c.utmCampaign].filter(Boolean).join(' - ') || 'Unknown',
          spend: '-',
          leads: c.visitors || 0,
          cpl: '-',
          revenue: `$${(c.revenue || 0).toLocaleString()}`,
          roi: '-',
        }))

      const channelMap: Record<string, { visitors: number, conversions: number }> = {}
      for (const c of campaignItems) {
        const channel = c.utmMedium || c.utmSource || 'Other'
        if (!channelMap[channel]) {
          channelMap[channel] = { visitors: 0, conversions: 0 }
        }
        channelMap[channel].visitors += c.visitors || 0
        channelMap[channel].conversions += c.conversions || 0
      }

      const channels = Object.entries(channelMap)
        .sort(([, a], [, b]) => b.visitors - a.visitors)
        .map(([channel, data]) => ({
          channel,
          spend: '-',
          leads: data.visitors,
          conversion: data.visitors > 0 ? `${((data.conversions / data.visitors) * 100).toFixed(1)}%` : '0%',
        }))

      return {
        stats,
        campaigns,
        channels,
        attribution: [],
      }
    }
    catch {
      return { stats: [], campaigns: [], channels: [], attribution: [] }
    }
  },
})
