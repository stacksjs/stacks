import { db } from '@stacksjs/database/runtime'
import type { DashboardJobStatus, ModelRecord, NormalizedJob } from './job-records'
import { normalizeActiveJob, normalizeFailedJob, parseJobReference } from './job-records'

/**
 * One page of the Jobs list, read by the database (stacksjs/stacks#3201).
 *
 * Jobs live in two tables: `jobs`, waiting or reserved, and `failed_jobs`.
 * The list used to read both whole and page them in memory. Now each is
 * filtered and counted in SQL. A page is newest first across both: for page
 * p of n, each table gives its newest p * n matches, which must hold the
 * page, and the two are merged and sliced. Deep pages read more, never more
 * than the matching rows.
 *
 * Through `db` rather than the models: a model query's `whereLike` is a plain
 * LIKE, which is case-sensitive on PostgreSQL, while `db` compares both sides
 * lowercased on every dialect.
 */

export interface JobListQuery {
  page: number
  perPage: number
  /** An exact queue, or empty for every queue. */
  queue: string
  status: DashboardJobStatus | ''
  search: string
}

export interface JobListPage {
  data: NormalizedJob[]
  total: number
  page: number
  /** Every queue with a job or a failure, for the queue filter. */
  queues: string[]
}

const STATES: DashboardJobStatus[] = ['queued', 'processing', 'failed']

/** The states whose name holds the search, which the list always searched. */
function statesNamed(term: string): Set<DashboardJobStatus> {
  return new Set(term ? STATES.filter(state => state.includes(term)) : [])
}

/** An id the search names: `12`, or a reference such as `job-12`. */
function idNamed(term: string, source: 'job' | 'failed'): number | null {
  const reference = parseJobReference(term)
  const id = reference.source === null || reference.source === source ? reference.id : ''
  return /^\d+$/.test(id) ? Number(id) : null
}

/**
 * A job is reserved when `reserved_at` is set and not 0, `queuedJobState`'s
 * rule in `@stacksjs/queue`. The queue writes NULL or a timestamp, never 0.
 */
function activeQuery(query: JobListQuery): any | null {
  if (query.status === 'failed')
    return null

  let chain: any = db.selectFrom('jobs')
  if (query.queue)
    chain = chain.where('queue', '=', query.queue)
  if (query.status === 'processing')
    chain = chain.whereNotNull('reserved_at').where('reserved_at', '!=', 0)
  else if (query.status === 'queued')
    chain = chain.whereGroup((group: any) => group.whereNull('reserved_at').orWhere('reserved_at', '=', 0))

  const term = query.search.toLowerCase()
  if (term) {
    const states = statesNamed(term)
    // Every waiting job's reference is `job-<id>`, so a search inside that
    // word names them all, as it did when the reference itself was searched.
    if ((states.has('queued') && states.has('processing')) || 'job-'.includes(term))
      return chain
    const id = idNamed(term, 'job')
    chain = chain.whereGroup((group: any) => {
      let match = group.whereLike('queue', `%${term}%`).orWhereLike('payload', `%${term}%`)
      if (id !== null)
        match = match.orWhere('id', '=', id)
      if (states.has('queued'))
        match = match.orWhereNull('reserved_at').orWhere('reserved_at', '=', 0)
      if (states.has('processing'))
        match = match.orWhere('reserved_at', '!=', 0)
      return match
    })
  }
  return chain
}

function failedQuery(query: JobListQuery): any | null {
  if (query.status === 'queued' || query.status === 'processing')
    return null

  let chain: any = db.selectFrom('failed_jobs')
  if (query.queue)
    chain = chain.where('queue', '=', query.queue)

  const term = query.search.toLowerCase()
  if (term && !statesNamed(term).has('failed') && !'failed-'.includes(term)) {
    const id = idNamed(term, 'failed')
    chain = chain.whereGroup((group: any) => {
      let match = group.whereLike('queue', `%${term}%`)
        .orWhereLike('payload', `%${term}%`)
        .orWhereLike('exception', `%${term}%`)
        .orWhereLike('connection', `%${term}%`)
      if (id !== null)
        match = match.orWhere('id', '=', id)
      return match
    })
  }
  return chain
}

/** A row as the normalizers read a model record. */
function asRecord(row: Record<string, unknown>): ModelRecord {
  return { get: (key: string) => row[key] } as unknown as ModelRecord
}

async function countOf(chain: any | null): Promise<number> {
  if (!chain)
    return 0
  const row = await chain.select(db.fn.count('id').as('count')).executeTakeFirst() as { count?: unknown } | undefined
  return Number(row?.count ?? 0) || 0
}

async function newestRows(chain: any, limit: number): Promise<Record<string, unknown>[]> {
  return await chain.selectAll().orderBy('created_at', 'desc').orderBy('id', 'desc').limit(limit).execute() as Record<string, unknown>[]
}

/** Newest first; at the same moment a waiting job before a failure, then the higher id, as before. */
function newestFirst(a: NormalizedJob, b: NormalizedJob): number {
  const byTime = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  if (byTime !== 0)
    return byTime
  if (a.source !== b.source)
    return a.source === 'job' ? -1 : 1
  return Number(b.recordId) - Number(a.recordId)
}

export async function readJobPage(query: JobListQuery): Promise<JobListPage> {
  const active = activeQuery(query)
  const failed = failedQuery(query)

  const [activeTotal, failedTotal, queueRows] = await Promise.all([
    countOf(active),
    countOf(failed),
    db.unsafe('SELECT DISTINCT queue FROM jobs UNION SELECT DISTINCT queue FROM failed_jobs').execute() as Promise<Array<{ queue: unknown }>>,
  ])

  const total = activeTotal + failedTotal
  const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.perPage)))
  const limit = page * query.perPage

  const [activeRows, failedRows] = await Promise.all([
    activeTotal > 0 ? newestRows(activeQuery(query), limit) : Promise.resolve([]),
    failedTotal > 0 ? newestRows(failedQuery(query), limit) : Promise.resolve([]),
  ])

  const data = [...activeRows.map(row => normalizeActiveJob(asRecord(row))), ...failedRows.map(row => normalizeFailedJob(asRecord(row)))]
    .sort(newestFirst)
    .slice((page - 1) * query.perPage, limit)

  return {
    data,
    total,
    page,
    queues: [...new Set(queueRows.map(row => String(row.queue ?? '')).filter(Boolean))].sort(),
  }
}
