import type { LogEvent } from 'kysely'
import { memoryUsage } from 'node:process'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { parseQuery } from './query-parser'
import { db as kysely } from './utils'

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

/**
 * Process an executed query and store it in the database
 */
export async function logQuery(event: LogEvent): Promise<void> {
  try {
    // Skip if database logging is disabled
    if (!config.database?.queryLogging?.enabled)
      return

    // Extract basic information from the event
    const { query, durationMs, error, bindings } = extractQueryInfo(event)

    // Determine query status based on duration and error
    const status = determineQueryStatus(durationMs, error)

    // Create the base log record
    const logRecord = await createQueryLogRecord(query, durationMs, status, error, bindings)

    // Add additional query analysis if necessary
    if (config.database?.queryLogging?.analysis?.enabled && (status === 'slow' || config.database.queryLogging.analysis.analyzeAll)) {
      await enhanceWithQueryAnalysis(logRecord)
    }

    // Store the query log in the database
    await storeQueryLog(logRecord)

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

      if (methodMatch) {
        const methodParts = methodMatch[1].split('.')
        caller = {
          model: methodParts.length > 1 ? methodParts[0] : undefined,
          method: methodParts.length > 1 ? methodParts[1] : methodParts[0],
        }
      }

      if (fileMatch) {
        caller = {
          ...caller,
          file: fileMatch[1],
          line: Number.parseInt(fileMatch[2], 10),
        }
      }
    }

    return {
      trace: stack,
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

/**
 * Get EXPLAIN plan for a query
 * Note: This is a simplified implementation
 */
async function getExplainPlan(query: string): Promise<any> {
  log.info('Getting explain plan for query:', query)
  try {
    // This should be implemented based on the specific database driver
    // For demonstration, we'll return a mock result
    return {
      plan: 'MOCK EXPLAIN PLAN',
      indexesUsed: ['primary_key'],
      missingIndexes: [],
    }

    // In a real implementation, you would:
    // 1. Run EXPLAIN on the query
    // 2. Parse the output to identify indexes used
    // 3. Identify potential missing indexes
  }
  catch (error) {
    log.debug('Error getting explain plan:', error)
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
    await kysely.insertInto('query_logs').values(logRecord).execute()
  }
  catch (error) {
    log.error('Failed to store query log:', error)
  }
}
