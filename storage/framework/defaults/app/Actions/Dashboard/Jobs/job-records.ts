export type JobRecordSource = 'job' | 'failed'
export type DashboardJobStatus = 'queued' | 'processing' | 'failed'

export interface ModelRecord {
  get: (key: string) => unknown
}

export interface NormalizedJob {
  id: string
  recordId: string
  source: JobRecordSource
  name: string
  queue: string
  connection: string | null
  status: DashboardJobStatus
  attempts: number | null
  maxAttempts: number | null
  duration: string | null
  runtime: number | null
  error?: string
  payload: unknown
  created_at: string
  updated_at?: string
  available_at?: string
  reserved_at?: string
  started_at?: string
  finished_at?: string
}

export function parsePayload(payload: unknown): unknown {
  if (typeof payload !== 'string')
    throw new TypeError('Job.payload must be a string.')
  try {
    return JSON.parse(payload)
  }
  catch {
    return payload
  }
}

function recordId(record: ModelRecord): string {
  const value = record.get('id')
  const id = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  if (!Number.isInteger(id) || id < 1)
    throw new TypeError('Job.id must be a positive integer.')
  return String(id)
}

export function jobReference(source: JobRecordSource, id: string): string {
  return `${source}-${id}`
}

export function parseJobReference(reference: string): { source: JobRecordSource | null, id: string } {
  const match = reference.match(/^(job|failed)-(.+)$/)
  if (!match)
    return { source: null, id: reference }
  return {
    source: match[1] as JobRecordSource,
    id: match[2]!,
  }
}

function requiredString(record: ModelRecord, key: string, model = 'Job'): string {
  const value = record.get(key)
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${model}.${key} must be a non-empty string.`)
  return value
}

function integerValue(
  record: ModelRecord,
  key: string,
  model = 'Job',
  minimum = 0,
  optional = false,
): number | null {
  const value = record.get(key)
  if (optional && (value === null || value === undefined))
    return null
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  if (!Number.isInteger(parsed) || parsed < minimum)
    throw new TypeError(`${model}.${key} must be an integer of at least ${minimum}.`)
  return parsed
}

function timestampValue(
  record: ModelRecord,
  key: string,
  model = 'Job',
  optional = false,
): string | undefined {
  const value = record.get(key)
  if (optional && (value === null || value === undefined || value === ''))
    return undefined

  let time = Number.NaN
  // Postgres and MySQL drivers return Date instances for timestamp columns;
  // SQLite stores TEXT and returns strings.
  if (value instanceof Date)
    time = value.getTime()
  else if (typeof value === 'number' && Number.isInteger(value) && value >= 0)
    time = value * 1000
  else if (typeof value === 'string' && value.trim())
    time = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(value) ? `${value.replace(' ', 'T')}Z` : value).getTime()

  if (!Number.isFinite(time))
    throw new TypeError(`${model}.${key} must be a valid timestamp.`)
  return new Date(time).toISOString()
}

function jobName(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const object = payload as { displayName?: unknown, job?: unknown, jobName?: unknown }
    for (const value of [object.jobName, object.displayName, object.job]) {
      if (typeof value === 'string' && value.trim())
        return value.replace(/^.*\\/, '')
    }
  }
  return fallback
}

function payloadMaxAttempts(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object')
    return null

  const object = payload as { displayName?: unknown, job?: unknown, jobName?: unknown, options?: unknown }
  const hasNativeName = typeof object.jobName === 'string' && Boolean(object.jobName.trim())
  if (!hasNativeName)
    return null

  const options = object.options
  if (options === null || options === undefined)
    return 1
  if (typeof options !== 'object')
    throw new TypeError('Job.payload.options must be an object.')

  const tries = (options as { tries?: unknown }).tries
  if (tries === null || tries === undefined)
    return 1
  const parsed = typeof tries === 'number'
    ? tries
    : typeof tries === 'string' && tries.trim() ? Number(tries) : Number.NaN
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new TypeError('Job.payload.options.tries must be a positive integer.')
  return parsed
}

export function normalizeActiveJob(record: ModelRecord): NormalizedJob {
  const id = recordId(record)
  const payload = parsePayload(record.get('payload'))
  const queue = requiredString(record, 'queue')
  const reservedAt = timestampValue(record, 'reserved_at', 'Job', true)

  return {
    id: jobReference('job', id),
    recordId: id,
    source: 'job',
    name: jobName(payload, queue),
    queue,
    connection: null,
    status: reservedAt ? 'processing' : 'queued',
    attempts: integerValue(record, 'attempts'),
    maxAttempts: payloadMaxAttempts(payload),
    duration: null,
    runtime: null,
    payload,
    created_at: timestampValue(record, 'created_at')!,
    updated_at: timestampValue(record, 'updated_at', 'Job', true),
    available_at: timestampValue(record, 'available_at', 'Job', true),
    reserved_at: reservedAt,
    started_at: reservedAt,
  }
}

export function normalizeFailedJob(record: ModelRecord): NormalizedJob {
  const id = recordId(record)
  const payload = parsePayload(record.get('payload'))
  const failedAt = timestampValue(record, 'failed_at', 'FailedJob', true)
  const runtime = integerValue(record, 'duration_ms', 'FailedJob', 0, true)
  const queue = requiredString(record, 'queue', 'FailedJob')

  return {
    id: jobReference('failed', id),
    recordId: id,
    source: 'failed',
    name: jobName(payload, queue),
    queue,
    connection: requiredString(record, 'connection', 'FailedJob'),
    status: 'failed',
    attempts: integerValue(record, 'attempts', 'FailedJob', 0, true),
    maxAttempts: integerValue(record, 'max_attempts', 'FailedJob', 1, true),
    duration: runtime === null ? null : `${runtime}ms`,
    runtime,
    error: requiredString(record, 'exception', 'FailedJob'),
    payload,
    created_at: timestampValue(record, 'created_at', 'FailedJob')!,
    updated_at: timestampValue(record, 'updated_at', 'FailedJob', true),
    finished_at: failedAt,
  }
}

export function matchesJobSearch(job: NormalizedJob, search: string): boolean {
  const query = search.trim().toLowerCase()
  if (!query)
    return true

  const payload = typeof job.payload === 'string'
    ? job.payload
    : JSON.stringify(job.payload ?? '')

  return [
    job.id,
    job.recordId,
    job.name,
    job.queue,
    job.connection || '',
    job.status,
    job.error || '',
    payload,
  ].some(value => value.toLowerCase().includes(query))
}
