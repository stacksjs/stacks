export type JobRecordSource = 'job' | 'failed'
export type DashboardJobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface ModelRecord {
  get: (key: string) => unknown
}

export interface NormalizedJob {
  id: string
  recordId: string
  source: JobRecordSource
  name: string
  queue: string
  connection: string
  status: DashboardJobStatus
  attempts: number
  maxAttempts: number
  duration: string
  runtime?: number
  error?: string
  payload: unknown
  created_at: string
  updated_at?: string
  available_at?: string
  reserved_at?: string
  started_at?: string
  finished_at?: string
}

const STATUS_MAP: Record<string, DashboardJobStatus> = {
  pending: 'queued',
  waiting: 'queued',
  queued: 'queued',
  active: 'processing',
  processing: 'processing',
  done: 'completed',
  completed: 'completed',
  failed: 'failed',
}

export function parsePayload(payload: unknown): unknown {
  if (typeof payload !== 'string')
    return payload ?? null
  try {
    return JSON.parse(payload)
  }
  catch {
    return payload
  }
}

export function jobReference(source: JobRecordSource, id: unknown): string {
  return `${source}-${String(id ?? '')}`
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

function jobName(record: ModelRecord, payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const displayName = (payload as { displayName?: unknown }).displayName
    if (typeof displayName === 'string' && displayName.trim())
      return displayName
  }
  return String(record.get('name') || record.get('queue') || fallback)
}

export function normalizeActiveJob(record: ModelRecord): NormalizedJob {
  const recordId = String(record.get('id') ?? '')
  const payload = parsePayload(record.get('payload'))
  const rawStatus = String(record.get('status') || 'pending').toLowerCase()
  const runtime = Number(record.get('duration') || 0)

  return {
    id: jobReference('job', recordId),
    recordId,
    source: 'job',
    name: jobName(record, payload, 'Job'),
    queue: String(record.get('queue') || 'default'),
    connection: String(record.get('connection') || ''),
    status: STATUS_MAP[rawStatus] || 'queued',
    attempts: Number(record.get('attempts') || 0),
    maxAttempts: Number(record.get('max_attempts') || 3),
    duration: runtime > 0 ? `${runtime}ms` : '-',
    runtime,
    payload,
    created_at: String(record.get('created_at') || ''),
    updated_at: String(record.get('updated_at') || ''),
    available_at: String(record.get('available_at') || ''),
    reserved_at: String(record.get('reserved_at') || ''),
    started_at: String(record.get('started_at') || ''),
    finished_at: String(record.get('finished_at') || ''),
  }
}

export function normalizeFailedJob(record: ModelRecord): NormalizedJob {
  const recordId = String(record.get('id') ?? '')
  const payload = parsePayload(record.get('payload'))
  const failedAt = String(record.get('failed_at') || record.get('created_at') || '')

  return {
    id: jobReference('failed', recordId),
    recordId,
    source: 'failed',
    name: jobName(record, payload, 'Failed job'),
    queue: String(record.get('queue') || 'default'),
    connection: String(record.get('connection') || ''),
    status: 'failed',
    attempts: Number(record.get('attempts') || 0),
    maxAttempts: Number(record.get('max_attempts') || 3),
    duration: '-',
    error: String(record.get('exception') || ''),
    payload,
    created_at: failedAt,
    updated_at: String(record.get('updated_at') || ''),
    finished_at: failedAt,
  }
}
