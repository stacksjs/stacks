import { Action } from '@stacksjs/actions/runtime'
import { FailedJob, Job } from '@stacksjs/orm'
import { aggregateWorkerMetrics, readWorkerSnapshots } from '@stacksjs/queue'
import { dashboardOperationalError } from '../dashboard-response'
import { readQueueCounts } from './queue-stats'

// A queued job has no `status` column - `queuedJobState` in @stacksjs/queue
// holds the rule (reserved_at means a worker has it; available_at in the
// future means it is not eligible yet), and the queue's own health check reads
// the same one. A row that finished is deleted by the worker, so 'completed'
// is not a state the jobs table can be in; failures live in `failed_jobs`.

export default new Action({
  name: 'QueueStatsAction',
  description: 'Returns aggregated queue statistics from the jobs/failed_jobs tables and the in-memory metrics tracker.',
  method: 'GET',
  async handle() {
    try {
      const [totalJobs, failedJobCount, counts] = await Promise.all([
        Job.count(),
        FailedJob.count(),
        readQueueCounts(),
      ])

      const queues = counts.map(queue => ({
        name: queue.name,
        status: queue.active > 0 ? 'active' : 'idle',
        pending: queue.pending,
        active: queue.active,
        completed: 0,
        failed: queue.failed,
        total: queue.total,
      }))
      const active = counts.reduce((sum, queue) => sum + queue.active, 0)

      // Workers publish bounded snapshots through their native QueueWorker model.
      // The dashboard reads those across processes rather than its own empty tracker.
      const metrics = aggregateWorkerMetrics(await readWorkerSnapshots())

      const stats = {
        totalQueues: queues.length,
        totalJobs,
        activeJobs: active,
        completedJobs: metrics.counts.completed,
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
