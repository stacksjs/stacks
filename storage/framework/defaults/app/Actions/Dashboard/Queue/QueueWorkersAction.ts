import { Action } from '@stacksjs/actions'
import { getActiveJobCount, getWorkerTracker, isWorkerRunning } from '@stacksjs/queue'

export default new Action({
  name: 'QueueWorkersAction',
  description: 'Returns queue worker information from the framework worker tracker.',
  method: 'GET',
  async handle() {
    try {
      const tracker = getWorkerTracker()
      const tracked = tracker.getAll()

      // Translate the tracker's internal status into the dashboard's vocabulary
      // ("running" | "paused" | "stopped") so the existing UI badges keep working.
      const data = tracked.map((w) => {
        const status = w.status === 'active' || w.status === 'idle' ? 'running' : 'stopped'
        const startedAt = new Date(w.startedAt)
        const elapsedMs = Math.max(0, Date.now() - startedAt.getTime())
        const elapsedHours = Math.floor(elapsedMs / 3_600_000)
        const elapsedDays = Math.floor(elapsedHours / 24)
        const uptime = elapsedDays > 0 ? `${elapsedDays}d ${elapsedHours % 24}h` : `${elapsedHours}h`

        return {
          id: w.id,
          name: w.id,
          status,
          queues: [w.queue],
          jobs_processed: w.processedCount,
          failed_jobs: w.failedCount,
          uptime,
          last_heartbeat: w.lastActivityAt,
          memory: '—',
        }
      })

      return {
        data,
        worker_running: isWorkerRunning(),
        active_jobs: getActiveJobCount(),
      }
    }
    catch {
      return { data: [], worker_running: false, active_jobs: 0 }
    }
  },
})
