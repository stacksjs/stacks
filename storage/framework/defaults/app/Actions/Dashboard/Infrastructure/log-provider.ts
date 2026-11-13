import type { HqClient } from '@stacksjs/hq/client'
import type { DashboardProviderUnavailable } from '../dashboard-provider'
import type { DashboardLogRecord, DashboardLogSummary } from './log-dashboard'
import { db } from '@stacksjs/database/runtime'
import { dashboardHqClient, hqUnavailableReason, readThroughProvider, resolveDashboardDriver } from '../dashboard-provider'
import { DASHBOARD_LOG_TYPES, normalizeDashboardLog, summarizeDashboardLogTypes } from './log-dashboard'

/**
 * Where the Logs section reads from.
 *
 * The local provider is the query that used to sit inside `LogIndexAction`,
 * moved without changing a line of its logic: the same five statements against
 * the `logs` table, the same filters, the same ordering, and the same clamp of
 * a requested page down to the last page that exists.
 *
 * The payload deliberately reuses `DashboardLogRecord` and
 * `DashboardLogSummary` from `log-dashboard.ts`. Three stx components import
 * those same types, so a provider that returns the wrong shape is a compile
 * error against the declaration the components themselves consume rather than
 * a surprise at runtime.
 */

export const DASHBOARD_LOG_RANGES = ['1', '7', '30', '90', 'all'] as const

export type DashboardLogRange = typeof DASHBOARD_LOG_RANGES[number]

export interface DashboardLogQuery {
  page: number
  perPage: number
  search: string
  /** One of {@link DASHBOARD_LOG_TYPES}, or empty for every level. */
  type: string
  source: string
  project: string
  range: DashboardLogRange
}

export interface DashboardLogPagination {
  page: number
  perPage: number
  total: number
  totalPages: number
}

export interface DashboardLogOptions {
  sources: string[]
  projects: string[]
  types: string[]
  ranges: string[]
}

export interface DashboardLogPayload extends Partial<DashboardProviderUnavailable> {
  logs: DashboardLogRecord[]
  summary: DashboardLogSummary
  pagination: DashboardLogPagination
  options: DashboardLogOptions
  generatedAt: string
}

export interface DashboardLogsProvider {
  logs: (query: DashboardLogQuery) => Promise<DashboardLogPayload>
}

/** An empty page of logs, carrying the reason there is nothing to show. */
export function emptyLogPayload(reason: string, query?: DashboardLogQuery): DashboardLogPayload {
  return {
    logs: [],
    summary: { total: 0, error: 0, warning: 0, info: 0, success: 0 },
    pagination: {
      page: 1,
      perPage: query?.perPage ?? 25,
      total: 0,
      totalPages: 1,
    },
    options: {
      sources: [],
      projects: [],
      types: [...DASHBOARD_LOG_TYPES],
      ranges: [...DASHBOARD_LOG_RANGES],
    },
    generatedAt: new Date().toISOString(),
    unavailable: reason,
  }
}

function isLogPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object')
    return false
  const candidate = payload as Partial<DashboardLogPayload>
  return Array.isArray(candidate.logs)
    && Boolean(candidate.summary)
    && Boolean(candidate.pagination)
    && Boolean(candidate.options)
}

/**
 * This application's own `logs` table.
 *
 * Not wrapped in a catch. A failure here is a local database failure, and the
 * action has always answered that with its operational error, which is the
 * behaviour every existing caller and test expects.
 */
export const localLogsProvider: DashboardLogsProvider = {
  async logs(query: DashboardLogQuery): Promise<DashboardLogPayload> {
    const cutoff = query.range === 'all' ? 0 : Date.now() - Number(query.range) * 86400000
    const searchPattern = `%${query.search}%`

    const applyFilters = <T extends {
      where: (...args: any[]) => T
      whereAny: (columns: string[], operator: string, value: unknown) => T
    }>(builder: T): T => {
      let filtered = builder
      if (cutoff)
        filtered = filtered.where('timestamp', '>=', cutoff)
      if (query.type)
        filtered = filtered.where('type', '=', query.type)
      if (query.source)
        filtered = filtered.where('source', '=', query.source)
      if (query.project)
        filtered = filtered.where('project', '=', query.project)
      if (query.search)
        filtered = filtered.whereAny(['message', 'project', 'file', 'stacktrace'], 'like', searchPattern)
      return filtered
    }

    const [countRow, typeRows, sourceRows, projectRows] = await Promise.all([
      applyFilters(db.selectFrom('logs').select(db.fn.count('id').as('count')))
        .executeTakeFirst() as unknown as { count: number | string } | undefined,
      applyFilters(db.selectFrom('logs').select(['type', db.fn.count('id').as('count')]))
        .groupBy('type')
        .execute() as unknown as Array<{ type: string, count: number | string }>,
      db.selectFrom('logs').select('source').distinct().orderBy('source', 'asc').limit(100).execute() as unknown as Array<{ source: string }>,
      db.selectFrom('logs').select('project').distinct().orderBy('project', 'asc').limit(500).execute() as unknown as Array<{ project: string }>,
    ])

    const total = Number(countRow?.count || 0)
    const totalPages = Math.max(1, Math.ceil(total / query.perPage))
    const page = Math.min(query.page, totalPages)
    const rows = await applyFilters(db.selectFrom('logs').select([
      'id',
      'timestamp',
      'type',
      'source',
      'message',
      'project',
      'stacktrace',
      'file',
      'created_at',
      'updated_at',
    ]))
      .orderBy('timestamp', 'desc')
      .orderBy('id', 'desc')
      .limit(query.perPage)
      .offset((page - 1) * query.perPage)
      .execute()

    return {
      logs: rows.map(normalizeDashboardLog),
      summary: summarizeDashboardLogTypes(typeRows, total),
      pagination: {
        page,
        perPage: query.perPage,
        total,
        totalPages,
      },
      options: {
        sources: sourceRows.map(row => row.source).filter(Boolean),
        projects: projectRows.map(row => row.project).filter(Boolean),
        types: [...DASHBOARD_LOG_TYPES],
        ranges: [...DASHBOARD_LOG_RANGES],
      },
      generatedAt: new Date().toISOString(),
    }
  },
}

/**
 * LogHQ's levels, as the four types this section filters and counts by.
 *
 * LogHQ has no `success`: the framework's logger sends one as `info`, so that
 * filter matches nothing here rather than guessing.
 */
const HQ_LEVELS_BY_TYPE: Record<string, string[]> = {
  error: ['error', 'critical', 'alert', 'emergency'],
  warning: ['warning'],
  info: ['info', 'notice', 'debug'],
  success: [],
}

function typeOfHqLevel(level: string): string {
  const normalized = level.toLowerCase()
  return Object.keys(HQ_LEVELS_BY_TYPE).find(type => HQ_LEVELS_BY_TYPE[type]!.includes(normalized)) ?? normalized
}

/** How many of LogHQ's pages a numbered page may walk to. It pages by cursor, not by number. */
const HQ_MAX_PAGE_WALK = 10

/**
 * LogHQ, read with the project's read key.
 *
 * Two things differ from the local table and are answered honestly rather
 * than faked. LogHQ pages by cursor and reports no total, so `total` is what
 * has been seen so far plus one when there is more, which is enough for the
 * pager to offer the next page. And the summary counts the page shown, not
 * the whole stream.
 */
export function hqLogsProvider(client: Pick<HqClient, 'logs'>, now: () => number = Date.now): DashboardLogsProvider {
  return {
    async logs(query: DashboardLogQuery): Promise<DashboardLogPayload> {
      const levels = query.type ? HQ_LEVELS_BY_TYPE[query.type] ?? [query.type] : undefined
      if (levels && !levels.length)
        return { ...emptyLogPayload('', query), unavailable: undefined }

      const cutoff = query.range === 'all' ? 0 : now() - Number(query.range) * 86400000
      let page = 1
      let cursor: string | undefined
      let entries: Awaited<ReturnType<HqClient['logs']['list']>> & { ok: true } | undefined

      for (; page <= Math.min(query.page, HQ_MAX_PAGE_WALK); page++) {
        const result = await client.logs.list({
          level: levels,
          channel: query.source || undefined,
          search: query.search || undefined,
          before: cursor,
          limit: query.perPage,
        })
        if (!result.ok)
          return emptyLogPayload(hqUnavailableReason(result), query)
        entries = result
        if (!result.data.nextCursor || page === Math.min(query.page, HQ_MAX_PAGE_WALK))
          break
        cursor = result.data.nextCursor
      }

      const all = entries?.data.logs ?? []
      // Newest first, so everything after the first entry older than the range is older too.
      const inRange = cutoff ? all.filter(log => !(Date.parse(log.timestamp) < cutoff)) : all
      const hasMore = Boolean(entries?.data.nextCursor) && inRange.length === all.length
      const offset = (page - 1) * query.perPage

      const logs = inRange.map((log, index) => normalizeDashboardLog({
        // LogHQ's ids are strings and this section keys rows by number.
        id: offset + index + 1,
        timestamp: log.timestamp,
        type: typeOfHqLevel(log.level),
        source: log.channel ?? '',
        message: log.message,
        // LogHQ's project is the one the read key opens; an entry carries no other.
        project: '',
        created_at: log.createdAt ?? log.timestamp,
      }))
      const total = offset + logs.length + (hasMore ? 1 : 0)
      const typeCounts = new Map<string, number>()
      for (const log of logs)
        typeCounts.set(log.type, (typeCounts.get(log.type) ?? 0) + 1)

      return {
        logs,
        summary: summarizeDashboardLogTypes([...typeCounts].map(([type, count]) => ({ type, count })), total),
        pagination: { page, perPage: query.perPage, total, totalPages: page + (hasMore ? 1 : 0) },
        options: {
          sources: [...new Set(logs.map(log => log.source).filter(Boolean))].sort(),
          projects: [],
          types: [...DASHBOARD_LOG_TYPES],
          ranges: [...DASHBOARD_LOG_RANGES],
        },
        generatedAt: new Date(now()).toISOString(),
      }
    },
  }
}

/** Reads the Logs section through whichever provider config selects. */
export async function readDashboardLogs(query: DashboardLogQuery): Promise<DashboardLogPayload> {
  const driver = await resolveDashboardDriver('logs')

  if (driver.name === 'local')
    return localLogsProvider.logs(query)

  return readThroughProvider(
    'logs',
    reason => emptyLogPayload(reason, query),
    async () => hqLogsProvider(await dashboardHqClient('logs', driver.options)).logs(query),
    isLogPayload,
  )
}
