import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'EventAnalyticsAction',
  description: 'Returns goals and conversions data from ts-analytics.',
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
      const startPeriod = AnalyticsStore.getPeriodStart(thirtyDaysAgo, period)

      const goalsCmd = store.listGoalsCommand('default')
      const goalsResult = (goalsCmd as unknown as { Items?: unknown[] })?.Items ?? []
      const goalItems = goalsResult as any[]

      // Fetch goal stats for each goal
      const goalStatsPromises = goalItems.map((goal: any) => {
        const cmd = store.getGoalStatsCommand('default', goal.id, period, startPeriod, periodStart)
        return (cmd as unknown as { Items?: unknown[] })?.Items ?? []
      })

      const goalStatsResults = await Promise.all(goalStatsPromises)

      const goals = goalItems.map((goal: any, index: number) => {
        const stats = goalStatsResults[index] as any[]
        const totalConversions = stats.reduce((sum: number, s: any) => sum + (s.conversions || 0), 0)
        const target = goal.value || 100
        const progress = target > 0 ? (totalConversions / target) * 100 : 0

        let status = 'on_track'
        if (progress >= 100) status = 'completed'
        else if (progress < 50) status = 'at_risk'

        return {
          name: goal.name,
          target,
          current: totalConversions,
          progress: Math.round(progress * 10) / 10,
          status,
        }
      })

      const activeGoals = goals.length
      const completedGoals = goals.filter(g => g.status === 'completed').length
      const atRiskGoals = goals.filter(g => g.status === 'at_risk').length
      const avgProgress = goals.length > 0
        ? goals.reduce((sum, g) => sum + g.progress, 0) / goals.length
        : 0

      const stats = [
        { label: 'Active Goals', value: String(activeGoals) },
        { label: 'Completed', value: String(completedGoals) },
        { label: 'Avg Progress', value: `${avgProgress.toFixed(1)}%` },
        { label: 'At Risk', value: String(atRiskGoals) },
      ]

      // Get event stats for conversion funnels
      const eventStatsCmd = store.getEventStatsCommand('default', period, periodStart)
      const eventStatsResult = (eventStatsCmd as unknown as { Items?: unknown[] })?.Items ?? []
      const eventItems = eventStatsResult as any[]

      const conversions = eventItems
        .filter((e: any) => e.count > 0)
        .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
        .slice(0, 10)
        .map((e: any) => ({
          funnel: e.eventName || 'Unknown',
          rate: e.uniqueVisitors > 0 ? `${((e.count / e.uniqueVisitors) * 100).toFixed(1)}%` : '0%',
          visitors: (e.uniqueVisitors || 0).toLocaleString(),
          conversions: (e.count || 0).toLocaleString(),
        }))

      return {
        goals,
        stats,
        conversions,
      }
    }
    catch {
      return { goals: [], stats: [], conversions: [] }
    }
  },
})
