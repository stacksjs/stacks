import { Action } from '@stacksjs/actions'
import { FailedJob, Job } from '@stacksjs/orm'
import { getGlobalMetrics } from '@stacksjs/queue'

interface QueueBucket {
  pending: number
  active: number
  completed: number
  failed: number
  total: number
}

const isPending = (status: string) => status === 'pending' || status === 'waiting' || status === 'queued'
const isActive = (status: string) => status === 'processing' || status === 'active'
const isCompleted = (status: string) => status === 'completed' || status === 'done'

export default new Action({
  name: 'QueueStatsAction',
  description: 'Returns aggregated queue statistics from the jobs/failed_jobs tables and the in-memory metrics tracker.',
  method: 'GET',
  async handle() {
    try {
      const [totalJobs, failedJobCount, allJobs] = await Promise.all([
        Job.count(),
        FailedJob.count(),
        Job.all(),
      ])

      const queueMap: Record<string, QueueBucket> = {}
      let active = 0
      let completed = 0

      for (const j of allJobs) {
        const queueName = String(j.get('queue') || 'default')
        const status = String(j.get('status') || 'pending')

        if (!queueMap[queueName]) {
          queueMap[queueName] = { pending: 0, active: 0, completed: 0, failed: 0, total: 0 }
        }
        const bucket = queueMap[queueName]
        bucket.total++

        if (isPending(status)) bucket.pending++
        else if (isActive(status)) {
          bucket.active++
          active++
        }
        else if (isCompleted(status)) {
          bucket.completed++
          completed++
        }
        else if (status === 'failed') bucket.failed++
      }

      const queues = Object.entries(queueMap).map(([name, data]) => ({
        name,
        status: data.active > 0 ? 'active' : 'idle',
        pending: data.pending,
        active: data.active,
        completed: data.completed,
        failed: data.failed,
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
    catch {
      return {
        queues: [],
        stats: {
          totalQueues: 0,
          totalJobs: 0,
          activeJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          throughputPerMinute: 0,
          averageProcessingTimeMs: 0,
        },
        queueConnected: false,
      }
    }
  },
})
