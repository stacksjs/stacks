import { Action } from '@stacksjs/actions'
import { FailedJob, Job } from '@stacksjs/orm'
import { getGlobalMetrics } from '@stacksjs/queue'
import { dashboardOperationalError } from '../dashboard-response'

interface QueueBucket {
  pending: number
  active: number
  completed: number
  failed: number
  total: number
}

/**
 * A queued job has no `status` column - the queue expresses state through
 * `reserved_at` (a worker has claimed it) and `available_at` (when it becomes
 * eligible). This action used to read `j.get('status')`, which no version of
 * the Job model has ever had, so every job fell to the 'pending' default and
 * the dashboard's active count was always zero.
 *
 * A row that has run to completion is deleted by the worker, so 'completed'
 * is not a state the jobs table can be in; failures live in `failed_jobs`.
 */
function jobState(reservedAt: unknown): 'pending' | 'active' {
  return reservedAt ? 'active' : 'pending'
}

export default new Action({
  name: 'QueueStatsAction',
  description: 'Returns aggregated queue statistics from the jobs/failed_jobs tables and the in-memory metrics tracker.',
  method: 'GET',
  async handle() {
    try {
      const [totalJobs, failedJobCount, allJobs, allFailedJobs] = await Promise.all([
        Job.count(),
        FailedJob.count(),
        Job.all(),
        FailedJob.all(),
      ])

      const queueMap: Record<string, QueueBucket> = {}

      // Per-queue failure counts come from failed_jobs, which is where a
      // failure actually lands. This column read `status === 'failed'` off the
      // jobs table before, and so was always zero.
      const failedByQueue = new Map<string, number>()
      for (const f of allFailedJobs) {
        const queueName = String(f.get('queue') || 'default')
        failedByQueue.set(queueName, (failedByQueue.get(queueName) ?? 0) + 1)
      }
      let active = 0
      const completed = 0

      for (const j of allJobs) {
        const queueName = String(j.get('queue') || 'default')
        const status = jobState(j.get('reserved_at'))

        if (!queueMap[queueName]) {
          queueMap[queueName] = { pending: 0, active: 0, completed: 0, failed: 0, total: 0 }
        }
        const bucket = queueMap[queueName]
        bucket.total++

        if (status === 'pending') {
          bucket.pending++
        }
        else {
          bucket.active++
          active++
        }
      }

      const queues = Object.entries(queueMap).map(([name, data]) => ({
        name,
        status: data.active > 0 ? 'active' : 'idle',
        pending: data.pending,
        active: data.active,
        completed: data.completed,
        failed: failedByQueue.get(name) ?? data.failed,
        total: data.total,
      }))

      // The in-memory metrics tracker only sees jobs processed since the
      // current API process started, so it complements (not replaces) the DB
      // counts. If the process just booted there's nothing here yet.
      const metrics = getGlobalMetrics().getMetrics()

      const stats = {
        totalQueues: queues.length,
        totalJobs,
        activeJobs: active,
        completedJobs: completed,
        failedJobs: failedJobCount,
        throughputPerMinute: metrics.throughputPerMinute,
        averageProcessingTimeMs: Math.round(metrics.averageDuration),
      }

      return { queues, stats, queueConnected: true }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Queue statistics could not be loaded.', 'QueueStatsAction')
    }
  },
})
