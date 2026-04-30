import { Action } from '@stacksjs/actions'
import { FailedJob, Job } from '@stacksjs/orm'
import { request } from '@stacksjs/router'

interface NormalizedJob {
  id: string
  name: string
  queue: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  attempts: number
  maxAttempts: number
  duration: string
  runtime?: number
  error?: string
  payload: unknown
  created_at: string
  started_at?: string
  finished_at?: string
}

const STATUS_MAP: Record<string, NormalizedJob['status']> = {
  pending: 'queued',
  waiting: 'queued',
  queued: 'queued',
  active: 'processing',
  processing: 'processing',
  done: 'completed',
  completed: 'completed',
  failed: 'failed',
}

function safeParse(payload: unknown): unknown {
  if (typeof payload !== 'string') return payload ?? null
  try {
    return JSON.parse(payload)
  }
  catch {
    return payload
  }
}

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

      const activeNormalized: NormalizedJob[] = activeJobs.map((j) => {
        const rawStatus = String(j.get('status') || 'pending').toLowerCase()
        const status = STATUS_MAP[rawStatus] || 'queued'
        const payload = safeParse(j.get('payload'))
        const name = String(
          (payload && typeof payload === 'object' && (payload as { displayName?: string }).displayName)
          || j.get('name')
          || j.get('queue')
          || 'Job',
        )
        const duration = j.get('duration') ? `${j.get('duration')}ms` : '-'
        return {
          id: String(j.get('id') ?? ''),
          name,
          queue: String(j.get('queue') || 'default'),
          status,
          attempts: Number(j.get('attempts') || 0),
          maxAttempts: Number(j.get('max_attempts') || 3),
          duration,
          runtime: Number(j.get('duration') || 0),
          payload,
          created_at: String(j.get('created_at') || ''),
        }
      })

      const failedNormalized: NormalizedJob[] = failedJobs.map((f) => {
        const payload = safeParse(f.get('payload'))
        const name = String(
          (payload && typeof payload === 'object' && (payload as { displayName?: string }).displayName)
          || f.get('queue')
          || 'Failed job',
        )
        return {
          id: String(f.get('id') ?? ''),
          name,
          queue: String(f.get('queue') || 'default'),
          status: 'failed',
          attempts: Number(f.get('attempts') || 0),
          maxAttempts: Number(f.get('max_attempts') || 3),
          duration: '-',
          error: String(f.get('exception') || ''),
          payload,
          created_at: String(f.get('failed_at') || f.get('created_at') || ''),
          finished_at: String(f.get('failed_at') || ''),
        }
      })

      const merged = [...activeNormalized, ...failedNormalized].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )

      const filtered = merged.filter((job) => {
        if (queueFilter && queueFilter !== 'all' && job.queue !== queueFilter) return false
        if (statusFilter && statusFilter !== 'all' && job.status !== statusFilter) return false
        if (search && !job.name.toLowerCase().includes(search)) return false
        return true
      })

      const total = filtered.length
      const start = (page - 1) * perPage
      const data = filtered.slice(start, start + perPage)
      const queues = Array.from(new Set(merged.map(j => j.queue))).sort()

      return { data, total, page, perPage, queues, queueConnected: true }
    }
    catch {
      return { data: [], total: 0, page, perPage, queues: [], queueConnected: false }
    }
  },
})
