export interface QueryLogSourceRow {
  id: number | string
  query: string
  normalized_query?: string | null
  duration?: number | null
  connection?: string | null
  status?: string | null
  error?: string | null
  executed_at: string
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

export function parseQueryLogList(value?: string | null): string[] {
  if (!value)
    return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  }
  catch {
    return []
  }
}

export function mapDashboardQueryLog(row: QueryLogSourceRow): DashboardQueryLog {
  const status = row.status === 'failed' || row.status === 'slow' ? row.status : 'completed'
  return {
    id: row.id,
    query: row.query,
    normalizedQuery: row.normalized_query || row.query,
    type: queryType(row.query),
    duration: Number(row.duration) || 0,
    connection: row.connection || 'unknown',
    status,
    error: row.error || '',
    executedAt: row.executed_at,
    model: row.model || '',
    method: row.method || '',
    rowsAffected: row.rows_affected == null ? null : Number(row.rows_affected),
    memoryUsage: row.memory_usage == null ? null : Number(row.memory_usage),
    tags: parseQueryLogList(row.tags),
    affectedTables: parseQueryLogList(row.affected_tables),
    indexesUsed: parseQueryLogList(row.indexes_used),
    missingIndexes: parseQueryLogList(row.missing_indexes),
    suggestions: parseQueryLogList(row.optimization_suggestions),
  }
}
