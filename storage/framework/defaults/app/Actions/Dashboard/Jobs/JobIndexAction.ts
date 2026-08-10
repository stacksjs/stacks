import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { FailedJob, Job } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import { matchesJobSearch, normalizeActiveJob, normalizeFailedJob } from './job-records'

export default new Action({
  name: 'JobIndexAction',
  description: 'Returns a paginated list of jobs across the active queue and the failed_jobs table.',
  method: 'GET',
  async handle(request: RequestInstance) {
    const page = Math.max(1, Number(request.get('page', 1)) || 1)
    const perPage = Math.min(200, Math.max(1, Number(request.get('per_page', 25)) || 25))
    const queueFilter = String(request.get('queue', '')).trim()
    const statusFilter = String(request.get('status', '')).trim().toLowerCase()
    const search = String(request.get('search', '')).trim().toLowerCase()

    try {
      const [activeJobs, failedJobs] = await Promise.all([
        Job.orderByDesc('id').get(),
        FailedJob.orderByDesc('id').get(),
      ])

      const activeNormalized = activeJobs.map(normalizeActiveJob)
      const failedNormalized = failedJobs.map(normalizeFailedJob)

      const merged = [...activeNormalized, ...failedNormalized].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )

      const filtered = merged.filter((job) => {
        if (queueFilter && queueFilter !== 'all' && job.queue !== queueFilter) return false
        if (statusFilter && statusFilter !== 'all' && job.status !== statusFilter) return false
        if (!matchesJobSearch(job, search)) return false
        return true
      })

      const total = filtered.length
      const start = (page - 1) * perPage
      const data = filtered.slice(start, start + perPage)
      const queues = Array.from(new Set(merged.map(j => j.queue))).sort()

      return { data, total, page, perPage, queues, queueConnected: true }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Job history could not be loaded.', 'JobIndexAction')
    }
  },
})
