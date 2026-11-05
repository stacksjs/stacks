import { db, getDatabaseDialect, sqlDateTime, sqlHelpers } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import type { DashboardQueryLog } from './query-dashboard'
import { dashboardQueryColumns, mapDashboardQueryLog, QUERY_TYPES, queryTypeSql } from './query-dashboard'

/**
 * One page of the query log, read by the database.
 *
 * The Queries pages used to fetch the newest 2,000 logs and filter, count and
 * page those in the browser, so a week, or a slow query older than the
 * newest 2,000, was simply not there (stacksjs/stacks#3204). Now the range,
 * filters, counts and page are all SQL.
 */

export const QUERY_RANGES = { hour: 1, day: 24, week: 168 } as const
export const QUERY_STATUSES = ['completed', 'slow', 'failed'] as const

export type QueryRange = keyof typeof QUERY_RANGES
export type QueryStatus = typeof QUERY_STATUSES[number]

export interface QueryListQuery {
  range: QueryRange
  status: QueryStatus | 'all'
  type: DashboardQueryLog['type'] | 'all'
  connection: string
  page: number
  perPage: number
}

export interface QueryCounts {
  total: number
  reads: number
  writes: number
  slow: number
  failed: number
  /** Mean duration in milliseconds, 0 when nothing matched. */
  averageDuration: number
}

export interface QueryLogPage {
  rows: DashboardQueryLog[]
  /** The page the rows are, moved back to the last one when it ran past it. */
  page: number
  /** Counts over every log matching the range and filters; `total` is what the pager counts. */
  counts: QueryCounts
  /** The connections that logged anything in the range, for the connection filter. */
  connections: string[]
}

/** The range, filters and page, or the reason they are invalid. Absent values take the page's defaults. */
export function parseQueryListQuery(read: QueryReader): QueryListQuery | { error: string } {
  const range = queryText(read, 'range') || 'day'
  if (!Object.hasOwn(QUERY_RANGES, range))
    return { error: `range must be one of ${Object.keys(QUERY_RANGES).join(', ')}.` }

  const status = queryText(read, 'status') || 'all'
  if (status !== 'all' && !(QUERY_STATUSES as readonly string[]).includes(status))
    return { error: `status must be all or one of ${QUERY_STATUSES.join(', ')}.` }

  const type = queryText(read, 'type') || 'all'
  if (type !== 'all' && !(QUERY_TYPES as readonly string[]).includes(type))
    return { error: `type must be all or one of ${QUERY_TYPES.join(', ')}.` }

  const connection = queryText(read, 'connection')
  if (connection.length > 200)
    return { error: 'connection must be 200 characters or fewer.' }

  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 50 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  return {
    range: range as QueryRange,
    status: status as QueryListQuery['status'],
    type: type as QueryListQuery['type'],
    connection,
    page,
    perPage,
  }
}

/** The earliest `executed_at` in the range, in the form the query logger writes it. */
export function rangeStart(range: QueryRange, now: number = Date.now()): string {
  return sqlDateTime(new Date(now - QUERY_RANGES[range] * 3_600_000))
}

/**
 * The WHERE clause for a query, every value bound. The range alone is the
 * connection filter's scope, so it is built separately.
 */
function where(query: QueryListQuery, now: number): { range: { sql: string, values: unknown[] }, all: { sql: string, values: unknown[] } } {
  const dialect = getDatabaseDialect()
  const helpers = sqlHelpers(dialect)
  const values: unknown[] = []
  const bind = (value: unknown): string => {
    values.push(value)
    return helpers.param(values.length)
  }

  const clauses = [`executed_at >= ${bind(rangeStart(query.range, now))}`]
  const range = { sql: `WHERE ${clauses[0]}`, values: [...values] }
  if (query.status !== 'all')
    clauses.push(`status = ${bind(query.status)}`)
  if (query.type !== 'all')
    clauses.push(`${queryTypeSql(dialect)} = ${bind(query.type)}`)
  if (query.connection)
    clauses.push(`connection = ${bind(query.connection)}`)

  return { range, all: { sql: `WHERE ${clauses.join(' AND ')}`, values } }
}

export async function readQueryLogPage(query: QueryListQuery, now: number = Date.now()): Promise<QueryLogPage> {
  const type = queryTypeSql(getDatabaseDialect())
  const filter = where(query, now)

  const [[counted], connectionRows] = await Promise.all([
    db.unsafe(
      `SELECT COUNT(*) AS total_count,
        SUM(CASE WHEN ${type} = 'SELECT' THEN 1 ELSE 0 END) AS read_count,
        SUM(CASE WHEN ${type} IN ('INSERT', 'UPDATE', 'DELETE') THEN 1 ELSE 0 END) AS write_count,
        SUM(CASE WHEN status = 'slow' THEN 1 ELSE 0 END) AS slow_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
        AVG(duration) AS average_duration
       FROM query_logs ${filter.all.sql}`,
      filter.all.values,
    ).execute(),
    db.unsafe(`SELECT DISTINCT connection FROM query_logs ${filter.range.sql} ORDER BY connection`, filter.range.values).execute() as Promise<Array<{ connection: unknown }>>,
  ])

  const counts: QueryCounts = {
    total: countOf(counted?.total_count),
    reads: countOf(counted?.read_count),
    writes: countOf(counted?.write_count),
    slow: countOf(counted?.slow_count),
    failed: countOf(counted?.failed_count),
    averageDuration: countOf(counted?.average_duration),
  }

  const page = pageWithin(query.page, counts.total, query.perPage)
  const rows = counts.total === 0
    ? []
    : await db.unsafe(
      `SELECT ${dashboardQueryColumns.join(', ')} FROM query_logs ${filter.all.sql}
       ORDER BY executed_at DESC, id DESC LIMIT ${Math.trunc(query.perPage)} OFFSET ${Math.trunc((page - 1) * query.perPage)}`,
      filter.all.values,
    ).execute()

  return {
    rows: rows.map(row => mapDashboardQueryLog(row)),
    page,
    counts,
    connections: connectionRows.map(row => String(row.connection ?? 'unknown')),
  }
}
