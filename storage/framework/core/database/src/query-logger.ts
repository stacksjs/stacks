import { memoryUsage } from 'node:process'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { parseQuery } from './query-parser'
import { db } from './utils'

/**
 * Soft dependency on the router's query tracker. Importing it directly
 * creates the cycle `database → router → database` (router uses db
 * helpers transitively via middleware). The DI shape below lets the
 * router register its tracker at module-init time and lets the database
 * package stay leaf-node — runs that don't load the router (CLI tools,
 * cron tasks) silently no-op the tracker call.
 */
// eslint-disable-next-line pickier/no-unused-vars
type QueryTracker = (query: string, durationMs?: number, connection?: string) => void
let trackQuery: QueryTracker = () => { /* no-op until set */ }
export function setQueryTracker(fn: QueryTracker): void {
  trackQuery = fn
}

/**
 * Query log event type - compatible with bun-query-builder hooks
 */
interface LogEvent {
  query?: {
    sql?: string
    parameters?: unknown[]
  }
  queryDurationMillis?: number
  error?: Error | unknown
}

interface QueryLogRecord {
  query: string
  normalized_query: string
  duration: number
  connection: string
  status: 'completed' | 'failed' | 'slow'
  error?: string
  executed_at?: string
  bindings?: string
  trace?: string
  model?: string
  method?: string
  file?: string
  line?: number
  memory_usage?: number
  rows_affected?: number
  transaction_id?: string
  tags?: string
  affected_tables?: string
  indexes_used?: string
  missing_indexes?: string
  explain_plan?: string
  optimization_suggestions?: string
}

// Re-entrancy guard to prevent infinite recursion (logQuery → storeQueryLog → INSERT → logQuery)
let isLogging = false

/**
 * Process an executed query and store it in the database
 */
export async function logQuery(event: LogEvent): Promise<void> {
  // Prevent infinite recursion: skip logging our own query_logs INSERT
  if (isLogging) return

  try {
    // Extract basic information from the event
    const { query, durationMs, error, bindings } = extractQueryInfo(event)

    // Always track query for error page context (even if logging is disabled)
    try {
      trackQuery(query, durationMs, config.database?.default || 'unknown')
    }
    catch {
      // Ignore if router not available
    }

    // Skip database logging if disabled
    if (!config.database?.queryLogging?.enabled)
      return

    // Determine query status based on duration and error
    const status = determineQueryStatus(durationMs, error)

    // Create the base log record
    const logRecord = await createQueryLogRecord(query, durationMs, status, error, bindings)

    // Add additional query analysis if necessary
    if (config.database?.queryLogging?.analysis?.enabled && (status === 'slow' || config.database.queryLogging.analysis.analyzeAll)) {
      await enhanceWithQueryAnalysis(logRecord)
    }

    // Store the query log in the database (with re-entrancy guard)
    isLogging = true
    try {
      await storeQueryLog(logRecord)
    }
    finally {
      isLogging = false
    }

    // Log slow or failed queries to the application log
    if (status !== 'completed') {
      const logMethod = status === 'failed' ? 'error' : 'warn'

      log[logMethod](`Query ${status}:`, {
        query: logRecord.query,
        duration: logRecord.duration,
        connection: logRecord.connection,
        ...(error && { error }),
      })
    }
  }
  catch (err) {
    // Log error but don't throw - this is a background operation
    log.error('Failed to log query:', err)
  }
}

/**
 * Extract basic information from a query event
 */
function extractQueryInfo(event: any) {
  const query = event.query?.sql || ''
  const durationMs = event.queryDurationMillis || 0
  const error = event.error

  // Extract and safely stringify bindings if available
  let bindings
  if (event.query?.parameters) {
    try {
      bindings = JSON.stringify(event.query.parameters)
    }
    catch {
      bindings = '[]'
    }
  }

  return { query, durationMs, error, bindings }
}

/**
 * Determine the status of a query based on duration and error
 */
function determineQueryStatus(durationMs: number, error?: any): 'completed' | 'failed' | 'slow' {
  const slowThreshold = config.database?.queryLogging?.slowThreshold || 100 // in ms

  if (error)
    return 'failed'

  if (durationMs > slowThreshold)
    return 'slow'

  return 'completed'
}

/**
 * Create a base query log record
 */
async function createQueryLogRecord(
  query: string,
  durationMs: number,
  status: 'completed' | 'failed' | 'slow',
  error?: any,
  bindings?: string,
): Promise<QueryLogRecord> {
  // Get the current database connection
  const connection = config.database.default || 'unknown'

  // Get normalized query (replace specific values with placeholders)
  const normalizedQuery = parseQuery(query).normalized || query

  // Extract stack trace and caller information
  const { trace, caller } = extractTraceInfo()

  return {
    query,
    normalized_query: normalizedQuery,
    duration: durationMs,
    connection,
    status,
    error: error ? String(error) : undefined,
    executed_at: new Date().toISOString(),
    bindings,
    trace,
    ...caller,
    memory_usage: memoryUsage().heapUsed / 1024 / 1024, // in MB
  }
}

/**
 * Patterns that look secret-shaped in arbitrary text. We strip these
 * from stack traces before persisting because the trace ends up in
 * `query_logs.trace` and is visible to anyone with read access to that
 * table — including users with the operator dashboard role. Function
 * names and local variable contents can leak API keys, tokens, and
 * credentials when devs (or library code) bake secrets into identifiers.
 *
 * The patterns are intentionally aggressive: false positives just mean
 * an extra `<redacted>` in a trace, which is harmless. The opposite
 * (an unredacted secret in a long-lived audit log) is the bug we're
 * trying to prevent.
 */
const SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:sk|pk|rk|api|secret|token|bearer|password|pwd|key)[_-]?[A-Za-z0-9]{12,}/gi,
  /\bsk_(?:live|test)_[A-Za-z0-9]{20,}/g, // Stripe-shaped
  /\bAKIA[0-9A-Z]{16}/g, // AWS access key id
  /\b[A-Za-z0-9_-]{40,}\b(?=\s|$|['"])/g, // long opaque blobs (JWTs, AKSKs)
]

function sanitizeStackTrace(stack: string): string {
  let out = stack
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, '<redacted>')
  return out
}

/**
 * Extract stack trace and caller information
 */
function extractTraceInfo() {
  try {
    // Get the current stack trace
    const stack = new Error('Stack trace capture').stack || ''

    // Get the caller information (skipping this file's functions)
    const stackLines = stack.split('\n').slice(1)
    const callerLine = stackLines.find(line => !line.includes('query-logger.ts'))

    let caller = {}

    if (callerLine) {
      // Parse out model/method name and file/line information
      const methodMatch = callerLine.match(/at (.+?) \(/)
      const fileMatch = callerLine.match(/\((.+?):(\d+):(\d+)\)/)

      if (methodMatch && methodMatch[1]) {
        const methodParts = methodMatch[1].split('.')
        caller = {
          model: methodParts.length > 1 ? methodParts[0] : undefined,
          method: methodParts.length > 1 ? methodParts[1] : methodParts[0],
        }
      }

      if (fileMatch && fileMatch[1] && fileMatch[2]) {
        caller = {
          ...caller,
          file: fileMatch[1],
          line: Number.parseInt(fileMatch[2], 10),
        }
      }
    }

    return {
      trace: sanitizeStackTrace(stack),
      caller,
    }
  }
  catch {
    return { trace: '', caller: {} }
  }
}

/**
 * Enhance the query log with additional analysis
 */
async function enhanceWithQueryAnalysis(logRecord: QueryLogRecord): Promise<void> {
  try {
    // Parse the query to get affected tables
    const { tables, type } = parseQuery(logRecord.query)
    logRecord.affected_tables = JSON.stringify(tables || [])

    // If it's a SELECT query, try to get EXPLAIN plan
    if (type === 'SELECT' && config.database?.queryLogging?.analysis?.explainPlan) {
      const explainResult = await getExplainPlan(logRecord.query)

      if (explainResult) {
        logRecord.explain_plan = explainResult.plan
        logRecord.indexes_used = JSON.stringify(explainResult.indexesUsed || [])
        logRecord.missing_indexes = JSON.stringify(explainResult.missingIndexes || [])

        // Generate optimization suggestions
        if (config.database?.queryLogging?.analysis?.suggestions) {
          logRecord.optimization_suggestions = JSON.stringify(
            generateOptimizationSuggestions(explainResult, logRecord),
          )
        }
      }
    }

    // Try to capture rows affected if available from the connection
    if (type !== 'SELECT') {
      // This will be populated when possible by the database driver
      // in real implementation. For now, it stays undefined.
    }

    // Add tags based on query type and tables
    const tags = [type]
    if (tables && tables.length > 0) {
      tags.push(...tables.map(table => `table:${table}`))
    }
    logRecord.tags = JSON.stringify(tags)
  }
  catch (error) {
    log.debug('Error during query analysis:', error)
  }
}

interface ExplainResult {
  plan: string
  indexesUsed: string[]
  missingIndexes: string[]
}

/**
 * Run EXPLAIN against a SELECT query and parse the output for the
 * driver's "uses index" / "no index" signals.
 *
 * Best-effort: returns null on any error so a flaky EXPLAIN never breaks
 * the request that triggered the query log. The driver-specific parsing
 * is intentionally lenient — we surface plan text verbatim so users can
 * read it even if the heuristic misses.
 */
// Whitelist of dialects we know how to EXPLAIN. Anything outside this
// set short-circuits to null — without the whitelist, a future config
// path that lets `database.default` come from user-controllable input
// (e.g. a multi-tenant DB picker) could let an attacker steer EXPLAIN's
// keyword fragment, which is interpolated directly into the SQL we send.
const EXPLAIN_DIALECTS = new Set(['sqlite', 'mysql', 'postgres'])

async function getExplainPlan(query: string): Promise<ExplainResult | null> {
  // SQLite & MySQL/PostgreSQL all accept `EXPLAIN <select>` as a prefix.
  // We re-enter `db.unsafe(...)` instead of through the bun-query-builder
  // hooks so EXPLAIN itself doesn't end up logged (which would recurse
  // through the slow-query path forever).
  try {
    const rawDriver = (await import('@stacksjs/config')).config?.database?.default
    const driver = typeof rawDriver === 'string' ? rawDriver : 'sqlite'
    if (!EXPLAIN_DIALECTS.has(driver)) return null
    let sqlText: string
    if (driver === 'mysql') sqlText = `EXPLAIN FORMAT=JSON ${query}`
    else if (driver === 'postgres') sqlText = `EXPLAIN (FORMAT JSON) ${query}`
    else sqlText = `EXPLAIN QUERY PLAN ${query}`

    const result = await (db as any).unsafe?.(sqlText)
    if (!result) return null

    const rows = Array.isArray(result) ? result : (result.rows ?? [])
    const planText = JSON.stringify(rows)

    // Heuristics for missing indexes
    const indexesUsed: string[] = []
    const missingIndexes: string[] = []

    if (driver === 'sqlite') {
      // SQLite EXPLAIN QUERY PLAN rows look like { detail: 'SCAN tablename' }
      // (no index) vs { detail: 'SEARCH tablename USING INDEX idx_x' }.
      for (const row of rows as Array<{ detail?: string }>) {
        const detail = row?.detail || ''
        const idxMatch = detail.match(/USING (?:COVERING )?INDEX (\w+)/i)
        if (idxMatch && idxMatch[1]) {
          indexesUsed.push(idxMatch[1])
        }
        else {
          const scanMatch = detail.match(/^SCAN\s+(\w+)/i)
          if (scanMatch && scanMatch[1]) missingIndexes.push(scanMatch[1])
        }
      }
    }
    else if (driver === 'mysql') {
      // EXPLAIN FORMAT=JSON nests `query_block.table.access_type === 'ALL'` as
      // the "no index" signal. We do a flat scan of the JSON for `key` (used)
      // and `access_type: ALL` (full scan).
      const text = planText
      for (const m of text.matchAll(/"key"\s*:\s*"([^"]+)"/g)) {
        if (m[1]) indexesUsed.push(m[1])
      }
      for (const m of text.matchAll(/"table_name"\s*:\s*"([^"]+)"[^}]*"access_type"\s*:\s*"ALL"/g)) {
        if (m[1]) missingIndexes.push(m[1])
      }
    }
    else if (driver === 'postgres') {
      // PG `EXPLAIN (FORMAT JSON)` returns one row with a Plan tree. The
      // signal we want is `Node Type: Seq Scan` on a relation.
      const text = planText
      for (const m of text.matchAll(/"Index Name"\s*:\s*"([^"]+)"/g)) {
        if (m[1]) indexesUsed.push(m[1])
      }
      for (const m of text.matchAll(/"Node Type"\s*:\s*"Seq Scan"[^}]*"Relation Name"\s*:\s*"([^"]+)"/g)) {
        if (m[1]) missingIndexes.push(m[1])
      }
    }

    return {
      plan: planText.length > 4000 ? `${planText.slice(0, 4000)}…` : planText,
      indexesUsed: Array.from(new Set(indexesUsed)),
      missingIndexes: Array.from(new Set(missingIndexes)),
    }
  }
  catch (err) {
    log.debug('[query-logger] EXPLAIN failed (non-fatal):', err)
    return null
  }
}

/**
 * Generate optimization suggestions based on query analysis
 */
function generateOptimizationSuggestions(explainResult: any, logRecord: QueryLogRecord): string[] {
  const suggestions: string[] = []

  // Check for missing indexes
  if (explainResult.missingIndexes && explainResult.missingIndexes.length > 0) {
    suggestions.push(`Consider adding index on ${explainResult.missingIndexes.join(', ')}`)
  }

  // Check for slow queries
  if (logRecord.status === 'slow') {
    suggestions.push('Consider optimizing this query to reduce execution time')

    // Look for SELECT * pattern
    if (logRecord.query.toLowerCase().includes('select *')) {
      suggestions.push('Specify only needed columns instead of using SELECT *')
    }

    // Look for missing LIMIT
    if (!logRecord.query.toLowerCase().includes('limit')) {
      suggestions.push('Consider adding LIMIT clause to reduce result set size')
    }
  }

  return suggestions
}

/**
 * Store the query log in the database
 */
async function storeQueryLog(logRecord: QueryLogRecord): Promise<void> {
  try {
    await db.insertInto('query_logs').values(logRecord as unknown as Record<string, unknown>).execute()
  }
  catch (error) {
    log.error('Failed to store query log:', error)
  }
}
