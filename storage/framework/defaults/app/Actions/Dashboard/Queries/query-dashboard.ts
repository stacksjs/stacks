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

export const QUERY_TYPES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'OTHER'] as const

/** What `queryType` skips before the first word: ASCII whitespace, as SQL can strip it too. */
const LEADING_SPACE = /^[ \t\n\v\f\r]+/

/**
 * The statement's kind, from its first word. `queryTypeSql` is the same rule
 * in SQL, so the list can filter and count by kind in the database
 * (stacksjs/stacks#3204); keep the two in step.
 */
export function queryType(query: string): DashboardQueryLog['type'] {
  const type = query.replace(LEADING_SPACE, '').match(/^([a-z]+)/i)?.[1]?.toUpperCase()
  return type === 'SELECT' || type === 'INSERT' || type === 'UPDATE' || type === 'DELETE'
    ? type
    : 'OTHER'
}

const ASCII_LETTERS = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))
  .flatMap(letter => [letter, letter.toLowerCase()])
  .map(letter => `'${letter}'`)
  .join(', ')

/**
 * `queryType` as a SQL expression over `query_logs.query`, for one dialect.
 *
 * The text loses the same leading whitespace, then a kind matches when the
 * text starts with its keyword in any case and the next character is not a
 * letter, which is what `queryType`'s first-word match comes to. MySQL
 * compares bytes here, because its default collation would also match
 * accented letters.
 */
export function queryTypeSql(dialect: string): string {
  const space = [9, 10, 11, 12, 13]
  // MySQL's LTRIM strips spaces only. Its pattern holds the whitespace itself
  // in a plain literal, which takes the column's collation where CHAR() would
  // bring its own and be refused.
  const text = dialect === 'mysql'
    ? `REGEXP_REPLACE(query, '^[ ${space.map(code => String.fromCharCode(code)).join('')}]+', '')`
    : `LTRIM(query, ' ' || ${space.map(code => `${dialect === 'postgres' ? 'chr' : 'char'}(${code})`).join(' || ')})`
  const exact = (value: string): string => dialect === 'mysql' ? `CAST(${value} AS BINARY)` : value
  const branches = QUERY_TYPES.filter(type => type !== 'OTHER').map(type =>
    `WHEN ${exact(`UPPER(SUBSTR(${text}, 1, ${type.length}))`)} = '${type}' AND ${exact(`SUBSTR(${text}, ${type.length + 1}, 1)`)} NOT IN (${ASCII_LETTERS}) THEN '${type}'`)
  return `(CASE ${branches.join(' ')} ELSE 'OTHER' END)`
}

export function parseQueryLogList(value?: unknown, label = 'query log list'): string[] {
  if (value == null || value === '')
    return []
  if (typeof value !== 'string')
    throw new TypeError(`${label} must be JSON text`)

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

export function mapDashboardQueryLog(row: QueryLogSourceRow | Record<string, unknown>): DashboardQueryLog {
  const label = `query log ${row.id}`
  if (!((typeof row.id === 'number' && Number.isSafeInteger(row.id) && row.id > 0) || (typeof row.id === 'string' && row.id.trim())))
    throw new TypeError('Query log id must be a positive integer or a non-empty string')
  const text = (value: unknown, field: string): string => {
    if (value == null) return ''
    if (typeof value !== 'string') throw new TypeError(`${label} ${field} must be text or null`)
    return value
  }
  const status = queryStatus(row.status, label)
  if (typeof row.query !== 'string' || !row.query.trim())
    throw new TypeError(`${label} query must be a non-empty string`)
  const executedAt = row.executed_at instanceof Date ? row.executed_at.toISOString() : row.executed_at
  if (typeof executedAt !== 'string' || !executedAt.trim())
    throw new TypeError(`${label} executed_at must be a non-empty string`)

  return {
    id: row.id,
    query: row.query,
    normalizedQuery: text(row.normalized_query, 'normalized query') || row.query,
    type: queryType(row.query),
    duration: finiteNumber(row.duration, `${label} duration`),
    connection: text(row.connection, 'connection') || 'unknown',
    status,
    error: text(row.error, 'error'),
    executedAt,
    model: text(row.model, 'model'),
    method: text(row.method, 'method'),
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
