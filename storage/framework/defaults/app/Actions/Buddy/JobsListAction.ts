import { Action } from '@stacksjs/actions'

/**
 * GET /api/buddy/jobs
 *
 * Powers the existing `dashboard/jobs/history.stx` view. Reads the
 * `jobs` and `failed_jobs` tables and merges them into a single
 * timeline shape the dashboard already understands.
 *
 * Query params:
 *   - status: 'all' | 'queued' | 'processing' | 'completed' | 'failed'
 *   - queue:  'all' | <queue-name>
 *   - q:      free-text filter on job name
 *   - page, perPage: pagination
 */
export default new Action({
  name: 'Buddy Jobs List',
  description: 'List queued, in-flight, completed, and failed jobs for the admin dashboard.',

  async handle(request) {
    const status = String(request.get('status', 'all') ?? 'all')
    const queue = String(request.get('queue', 'all') ?? 'all')
    const q = String(request.get('q', '') ?? '')
    const page = Math.max(1, Number(request.get('page', 1) ?? 1))
    const perPage = Math.min(100, Math.max(1, Number(request.get('perPage', 25) ?? 25)))

    try {
      const { db } = await import('@stacksjs/database')
      const dbAny = db as any

      // Pull the live `jobs` table — this contains queued + reserved (processing) rows.
      let pendingQuery = dbAny.selectFrom('jobs').selectAll()
      if (queue !== 'all') pendingQuery = pendingQuery.where('queue', '=', queue)
      if (q) pendingQuery = pendingQuery.where('payload', 'like', `%${q}%`)

      // Pull the failed_jobs table for the failed status.
      let failedQuery = dbAny.selectFrom('failed_jobs').selectAll()
      if (queue !== 'all') failedQuery = failedQuery.where('queue', '=', queue)
      if (q) failedQuery = failedQuery.where('payload', 'like', `%${q}%`)

      const [pending, failed] = await Promise.all([
        status === 'failed' ? Promise.resolve([]) : pendingQuery.execute(),
        status === 'queued' || status === 'processing' || status === 'completed' ? Promise.resolve([]) : failedQuery.execute(),
      ])

      const normalized = [
        ...(pending as Array<Record<string, unknown>>).map(row => normalizePending(row, status)),
        ...(failed as Array<Record<string, unknown>>).map(normalizeFailed),
      ]
        .filter((j): j is NonNullable<typeof j> => j !== null)
        .sort((a, b) => (b.created_at?.localeCompare(a.created_at ?? '') ?? 0))

      const total = normalized.length
      const start = (page - 1) * perPage
      const items = normalized.slice(start, start + perPage)

      return {
        items,
        total,
        page,
        perPage,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      }
    }
    catch (err) {
      // Fail soft so the dashboard can render an empty state instead of
      // an opaque 500. Surface the underlying message so it's visible
      // in the dev-mode error toast.
      return {
        items: [],
        total: 0,
        page,
        perPage,
        totalPages: 1,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  },
})

interface NormalizedJob {
  id: string
  name: string
  queue: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  attempts: number
  runtime?: number
  started_at?: string
  finished_at?: string
  error?: string
  payload: unknown
  created_at?: string
}

function normalizePending(row: Record<string, unknown>, statusFilter: string): NormalizedJob | null {
  const status: NormalizedJob['status'] = row.reserved_at ? 'processing' : 'queued'
  if (statusFilter !== 'all' && statusFilter !== status) return null
  let payload: unknown = row.payload
  let name = 'unknown'
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload) as { jobName?: string }
      name = parsed.jobName ?? 'unknown'
      payload = parsed
    }
    catch { /* leave as raw string */ }
  }
  return {
    id: String(row.id ?? ''),
    name,
    queue: String(row.queue ?? 'default'),
    status,
    attempts: Number(row.attempts ?? 0),
    payload,
    created_at: row.created_at ? String(row.created_at) : undefined,
  }
}

function normalizeFailed(row: Record<string, unknown>): NormalizedJob {
  let payload: unknown = row.payload
  let name = 'unknown'
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload) as { jobName?: string }
      name = parsed.jobName ?? 'unknown'
      payload = parsed
    }
    catch { /* leave as raw */ }
  }
  return {
    id: String(row.id ?? ''),
    name,
    queue: String(row.queue ?? 'default'),
    status: 'failed',
    attempts: Number(row.attempts ?? 0),
    error: row.exception ? String(row.exception) : undefined,
    finished_at: row.failed_at ? String(row.failed_at) : undefined,
    payload,
    created_at: row.failed_at ? String(row.failed_at) : undefined,
  }
}
