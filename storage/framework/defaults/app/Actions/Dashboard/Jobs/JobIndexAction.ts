import { Action } from '@stacksjs/actions'
import { FailedJob, Job } from '@stacksjs/orm'
import { request, response } from '@stacksjs/router'
import { matchesJobSearch, normalizeActiveJob, normalizeFailedJob } from './job-records'

export default new Action({
  name: 'JobIndexAction',
  description: 'Returns a paginated list of jobs across the active queue and the failed_jobs table.',
  method: 'GET',
  async handle() {
    // bun-router populates `request.query` as a Record<string, string|string[]>.
    // Outside a request context (e.g. ad-hoc tests) it's undefined — fall back
    // to defaults so the action stays callable.
    const query = ((request as any).query || {}) as Record<string, string | string[] | undefined>
    const pick = (key: string) => {
      const v = query[key]
      return Array.isArray(v) ? v[0] : v
    }
    const page = Math.max(1, Number(pick('page')) || 1)
    const perPage = Math.min(200, Math.max(1, Number(pick('per_page')) || 25))
    const queueFilter = String(pick('queue') || '').trim()
    const statusFilter = String(pick('status') || '').trim().toLowerCase()
    const search = String(pick('search') || '').trim().toLowerCase()

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
      return response.json({
        message: error instanceof Error ? error.message : 'Job history could not be loaded.',
      }, 503)
    }
  },
})
