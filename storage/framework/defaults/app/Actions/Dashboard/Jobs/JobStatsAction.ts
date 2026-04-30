import { Action } from '@stacksjs/actions'
import { FailedJob, Job } from '@stacksjs/orm'
import { getGlobalMetrics } from '@stacksjs/queue'

export default new Action({
  name: 'JobStatsAction',
  description: 'Returns headline job statistics from the in-memory metrics tracker and DB job counts.',
  method: 'GET',
  async handle() {
    try {
      const [totalJobs, totalFailed] = await Promise.all([
        Job.count(),
        FailedJob.count(),
      ])

      const metrics = getGlobalMetrics().getMetrics()
      const completedSeen = metrics.counts.completed
      const failedSeen = metrics.counts.failed
      const totalSeen = completedSeen + failedSeen
      const failureRate = totalSeen > 0 ? `${((failedSeen / totalSeen) * 100).toFixed(1)}%` : '0%'

      const avgMs = Math.round(metrics.averageDuration)
      const avgProcessingTime = avgMs >= 1000
        ? `${(avgMs / 1000).toFixed(2)}s`
        : `${avgMs}ms`

      return {
        totalJobs,
        totalFailed,
        avgProcessingTime,
        jobsPerMinute: metrics.throughputPerMinute,
        failureRate,
        // The composable doesn't render a chart, so we omit the synthetic
        // throughput/waitTime arrays the previous handler returned. If you
        // need historical data, persist completion events and serve them
        // from a dedicated endpoint.
      }
    }
    catch {
      return {
        totalJobs: 0,
        totalFailed: 0,
        avgProcessingTime: '0ms',
        jobsPerMinute: 0,
        failureRate: '0%',
      }
    }
  },
})
