import process from 'node:process'
import { stat, statfs } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Action } from '@stacksjs/actions'
import { cache } from '@stacksjs/cache'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { checkQueueHealth } from '@stacksjs/queue'
import { dashboardOperationalIssue } from '../dashboard-response'
import {
  compactSql,
  countValue,
  filesystemUsage,
  finiteNumber,
  percent,
  safeRequestPath,
  summarizeStatuses,
  type NumericSummaryRow,
  type StatusCountRow,
} from './insights-dashboard'

interface SourceResult<T> {
  value: T
  error: string
}

async function inspectSource<T>(work: Promise<T>, fallback: T, message: string, source: string): Promise<SourceResult<T>> {
  try {
    return { value: await work, error: '' }
  }
  catch (error) {
    return {
      value: fallback,
      error: dashboardOperationalIssue(error, message, `InsightsAction.${source}`),
    }
  }
}

export default new Action({
  name: 'InsightsAction',
  description: 'Returns persisted observations and current infrastructure telemetry for the dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const startedAt = performance.now()
    const slowThresholdMs = Math.max(0, Number(config.database?.queryLogging?.slowThreshold || 100))
    const memory = process.memoryUsage()
    const cpu = process.cpuUsage()
    const databaseDriver = String(config.database?.default || 'unknown')

    const requestSummaryQuery = db
      .selectFrom('requests')
      .select([
        db.fn.count('id').as('total'),
        db.fn.avg('duration_ms').as('average'),
        db.fn.max('duration_ms').as('maximum'),
        db.fn.max('created_at').as('latest'),
      ])
      .whereNull('deleted_at')
      .executeTakeFirst() as Promise<NumericSummaryRow | undefined>

    const requestSuccessQuery = db
      .selectFrom('requests')
      .select(db.fn.count('id').as('count'))
      .whereNull('deleted_at')
      .where('status_code', '<', 400)
      .executeTakeFirst() as Promise<{ count: number | string } | undefined>

    const slowRequestsQuery = db
      .selectFrom('requests')
      .select(['id', 'method', 'path', 'status_code', 'duration_ms', 'created_at'])
      .whereNull('deleted_at')
      .orderBy('duration_ms', 'desc')
      .orderBy('id', 'desc')
      .limit(5)
      .execute()

    const querySummaryQuery = db
      .selectFrom('query_logs')
      .select([
        db.fn.count('id').as('total'),
        db.fn.avg('duration').as('average'),
        db.fn.max('duration').as('maximum'),
        db.fn.max('executed_at').as('latest'),
      ])
      .executeTakeFirst() as Promise<NumericSummaryRow | undefined>

    const queryStatusesQuery = db
      .selectFrom('query_logs')
      .select(['status', db.fn.count('id').as('count')])
      .groupBy('status')
      .execute() as Promise<StatusCountRow[]>

    const slowQueriesQuery = db
      .selectFrom('query_logs')
      .select(['id', 'query', 'duration', 'status', 'connection', 'executed_at'])
      .where('duration', '>=', slowThresholdMs)
      .orderBy('duration', 'desc')
      .orderBy('id', 'desc')
      .limit(5)
      .execute()

    const errorSummaryQuery = db
      .selectFrom('errors')
      .select([
        db.fn.count('id').as('total'),
        db.fn.max('created_at').as('latest'),
      ])
      .executeTakeFirst() as Promise<NumericSummaryRow | undefined>

    const recentErrorsQuery = db
      .selectFrom('errors')
      .select(['id', 'type', 'message', 'status', 'created_at'])
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(5)
      .execute()

    const filesystemQuery = statfs(process.cwd())
    const databaseFileQuery = databaseDriver === 'sqlite'
      ? stat(resolve(process.cwd(), String(config.database?.connections?.sqlite?.database || 'database/stacks.sqlite')))
      : Promise.resolve(null)

    const [
      requestSummary,
      requestSuccess,
      slowRequests,
      querySummary,
      queryStatuses,
      slowQueries,
      errorSummary,
      recentErrors,
      queueHealth,
      cacheStats,
      filesystem,
      databaseFile,
    ] = await Promise.all([
      inspectSource(requestSummaryQuery, undefined, 'Request telemetry is unavailable.', 'requests.summary'),
      inspectSource(requestSuccessQuery, undefined, 'Request telemetry is unavailable.', 'requests.success'),
      inspectSource(slowRequestsQuery, [], 'Request telemetry is unavailable.', 'requests.slowest'),
      inspectSource(querySummaryQuery, undefined, 'Query telemetry is unavailable.', 'queries.summary'),
      inspectSource(queryStatusesQuery, [], 'Query telemetry is unavailable.', 'queries.statuses'),
      inspectSource(slowQueriesQuery, [], 'Query telemetry is unavailable.', 'queries.slowest'),
      inspectSource(errorSummaryQuery, undefined, 'Error telemetry is unavailable.', 'errors.summary'),
      inspectSource(recentErrorsQuery, [], 'Error telemetry is unavailable.', 'errors.recent'),
      inspectSource(checkQueueHealth(), null, 'Queue telemetry is unavailable.', 'queue'),
      inspectSource(cache.getStats(), null, 'Cache telemetry is unavailable.', 'cache'),
      inspectSource(filesystemQuery, null, 'Filesystem telemetry is unavailable.', 'filesystem'),
      inspectSource(databaseFileQuery, null, 'Database file telemetry is unavailable.', 'database-file'),
    ])

    const requestTotal = countValue(requestSummary.value?.total)
    const successfulRequests = countValue(requestSuccess.value?.count)
    const statusCounts = summarizeStatuses(queryStatuses.value)
    const filesystemState = filesystem.value
      ? filesystemUsage(filesystem.value.bsize, filesystem.value.blocks, filesystem.value.bavail)
      : { totalBytes: 0, availableBytes: 0, usedBytes: 0, usedPercent: 0 }

    const issues = [
      ['requests', requestSummary.error || requestSuccess.error || slowRequests.error],
      ['queries', querySummary.error || queryStatuses.error || slowQueries.error],
      ['errors', errorSummary.error || recentErrors.error],
      ['queue', queueHealth.error],
      ['cache', cacheStats.error],
      ['filesystem', filesystem.error],
      ['database file', databaseFile.error],
    ]
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
      .map(([source, message]) => ({ source, message }))

    return {
      sampledAt: new Date().toISOString(),
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      issues,
      requests: {
        total: requestTotal,
        successful: successfulRequests,
        errors: Math.max(0, requestTotal - successfulRequests),
        successRate: percent(successfulRequests, requestTotal),
        averageDurationMs: finiteNumber(requestSummary.value?.average),
        maximumDurationMs: finiteNumber(requestSummary.value?.maximum),
        latestAt: requestSummary.value?.latest || '',
        slowest: slowRequests.value.map(row => ({
          id: countValue(row.id),
          method: String(row.method || 'GET'),
          path: safeRequestPath(row.path),
          statusCode: countValue(row.status_code),
          durationMs: finiteNumber(row.duration_ms),
          recordedAt: String(row.created_at || ''),
        })),
      },
      queries: {
        enabled: config.database?.queryLogging?.enabled === true,
        slowThresholdMs,
        total: countValue(querySummary.value?.total),
        completed: countValue(statusCounts.completed),
        slow: countValue(statusCounts.slow),
        failed: countValue(statusCounts.failed),
        averageDurationMs: finiteNumber(querySummary.value?.average),
        maximumDurationMs: finiteNumber(querySummary.value?.maximum),
        latestAt: querySummary.value?.latest || '',
        slowest: slowQueries.value.map(row => ({
          id: countValue(row.id),
          query: compactSql(row.query),
          durationMs: finiteNumber(row.duration),
          status: String(row.status || 'completed'),
          connection: String(row.connection || 'unknown'),
          executedAt: String(row.executed_at || ''),
        })),
      },
      runtime: {
        uptimeSeconds: Math.max(0, Math.floor(process.uptime())),
        cpuUserMs: Math.max(0, cpu.user / 1000),
        cpuSystemMs: Math.max(0, cpu.system / 1000),
        cpuTotalMs: Math.max(0, (cpu.user + cpu.system) / 1000),
        residentMemoryBytes: Math.max(0, memory.rss),
        heapUsedBytes: Math.max(0, memory.heapUsed),
        heapTotalBytes: Math.max(0, memory.heapTotal),
        heapUsedPercent: memory.heapTotal >= memory.heapUsed
          ? percent(memory.heapUsed, memory.heapTotal)
          : -1,
        externalMemoryBytes: Math.max(0, memory.external),
      },
      storage: {
        ...filesystemState,
        databaseDriver,
        databaseBytes: Math.max(0, finiteNumber(databaseFile.value?.size)),
      },
      queue: queueHealth.value,
      cache: cacheStats.value
        ? {
            hits: countValue(cacheStats.value.hits),
            misses: countValue(cacheStats.value.misses),
            keys: countValue(cacheStats.value.keys),
            sizeBytes: Math.max(0, finiteNumber(cacheStats.value.size)),
            hitRate: percent(cacheStats.value.hits, finiteNumber(cacheStats.value.hits) + finiteNumber(cacheStats.value.misses)),
          }
        : null,
      errors: {
        total: countValue(errorSummary.value?.total),
        latestAt: errorSummary.value?.latest || '',
        recent: recentErrors.value.map(row => ({
          id: countValue(row.id),
          type: String(row.type || 'Error'),
          message: String(row.message || ''),
          status: countValue(row.status),
          recordedAt: String(row.created_at || ''),
        })),
      },
    }
  },
})
