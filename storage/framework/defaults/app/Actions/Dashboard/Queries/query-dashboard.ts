export interface QueryLogSourceRow {
  id: number | string
  query: string
  normalized_query?: string | null
  duration?: number | null
  connection?: string | null
  status?: string | null
  error?: string | null
  // SQLite returns timestamp columns as TEXT; Postgres and MySQL drivers return Date instances.
  executed_at: string | Date
  model?: string | null
  method?: string | null
  rows_affected?: number | null
  memory_usage?: number | null
  tags?: string | null
  affected_tables?: string | null
  indexes_used?: string | null
  missing_indexes?: string | null
  optimization_suggestions?: string | null
}

export const dashboardQueryColumns = [
  'id',
  'query',
  'normalized_query',
  'duration',
  'connection',
  'status',
  'error',
  'executed_at',
  'model',
  'method',
  'rows_affected',
  'memory_usage',
  'tags',
  'affected_tables',
  'indexes_used',
  'missing_indexes',
  'optimization_suggestions',
] as const

export interface DashboardQueryLog {
  id: number | string
  query: string
  normalizedQuery: string
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER'
  duration: number
  connection: string
  status: 'completed' | 'failed' | 'slow'
  error: string
  executedAt: string
  model: string
  method: string
  rowsAffected: number | null
  memoryUsage: number | null
  tags: string[]
  affectedTables: string[]
  indexesUsed: string[]
  missingIndexes: string[]
  suggestions: string[]
}

export function queryType(query: string): DashboardQueryLog['type'] {
  const type = query.trim().match(/^([a-z]+)/i)?.[1]?.toUpperCase()
  return type === 'SELECT' || type === 'INSERT' || type === 'UPDATE' || type === 'DELETE'
    ? type
    : 'OTHER'
}

export function parseQueryLogList(value?: string | null, label = 'query log list'): string[] {
  if (!value)
    return []

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  }
  catch (error) {
    throw new Error(`Could not parse ${label}: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string'))
    throw new TypeError(`${label} must be a JSON array of strings`)

  return parsed
}

export function mapDashboardQueryLog(row: QueryLogSourceRow): DashboardQueryLog {
  const label = `query log ${row.id}`
  const status = queryStatus(row.status, label)
  if (typeof row.query !== 'string' || !row.query.trim())
    throw new TypeError(`${label} query must be a non-empty string`)
  const executedAt = row.executed_at instanceof Date ? row.executed_at.toISOString() : row.executed_at
  if (typeof executedAt !== 'string' || !executedAt.trim())
    throw new TypeError(`${label} executed_at must be a non-empty string`)

  return {
    id: row.id,
    query: row.query,
    normalizedQuery: row.normalized_query || row.query,
    type: queryType(row.query),
    duration: finiteNumber(row.duration, `${label} duration`),
    connection: row.connection || 'unknown',
    status,
    error: row.error || '',
    executedAt,
    model: row.model || '',
    method: row.method || '',
    rowsAffected: nullableFiniteNumber(row.rows_affected, `${label} rows_affected`),
    memoryUsage: nullableFiniteNumber(row.memory_usage, `${label} memory_usage`),
    tags: parseQueryLogList(row.tags, `${label} tags`),
    affectedTables: parseQueryLogList(row.affected_tables, `${label} affected_tables`),
    indexesUsed: parseQueryLogList(row.indexes_used, `${label} indexes_used`),
    missingIndexes: parseQueryLogList(row.missing_indexes, `${label} missing_indexes`),
    suggestions: parseQueryLogList(row.optimization_suggestions, `${label} optimization_suggestions`),
  }
}

function queryStatus(value: unknown, label: string): DashboardQueryLog['status'] {
  if (value === 'completed' || value === 'failed' || value === 'slow')
    return value
  throw new TypeError(`${label} status must be completed, failed, or slow`)
}

function finiteNumber(value: unknown, label: string): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : Number.NaN
  if (!Number.isFinite(parsed))
    throw new TypeError(`${label} must be a finite number`)
  return parsed
}

function nullableFiniteNumber(value: unknown, label: string): number | null {
  return value === null || value === undefined ? null : finiteNumber(value, label)
}
