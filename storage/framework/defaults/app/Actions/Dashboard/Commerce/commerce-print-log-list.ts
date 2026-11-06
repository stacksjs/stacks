import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect, sqlDateTime } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, pageWithin, queryText } from '../Content/content-list'
import { commerceIdentifier, commerceValue, referencedIds } from './commerce-record'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, idPlaceholders, sqlRows } from './commerce-sql'
import type { PrintLogRecord, PrintLogStatus, PrintLogSummary } from './print-log-records'
import { normalizePrintLogRecord } from './print-log-records'

/**
 * One page of print logs (receipts), with the summary and breakdown of every
 * log the search and filters match, read by the database
 * (stacksjs/stacks#3218).
 *
 * The endpoint already paged, but its cards and breakdowns described only
 * the twenty rows on screen, its export wrote only those, its search was a
 * case-sensitive LIKE on PostgreSQL that read `%` and `_` as wildcards, and
 * its record check read the first 500 print devices, so one log from a later
 * device failed the whole page.
 */
export const PRINT_LOG_STATUSES: readonly PrintLogStatus[] = ['failed', 'success', 'warning']
export const PRINT_LOG_RANGES = ['1', '7', '30', '90', 'all'] as const
export const PRINT_LOG_SORTS = ['newest', 'oldest', 'printer', 'duration'] as const
export type PrintLogSort = typeof PRINT_LOG_SORTS[number]

export interface PrintLogListQuery {
  search: string
  /** A printer name, or '' for any. */
  printer: string
  /** '' for any. */
  status: '' | PrintLogStatus
  /** Days back from now; 0 for all time. */
  days: number
  sort: PrintLogSort
  page: number
  perPage: number
}

/** What the breakdown panels show for the matching logs. */
export interface PrintLogBreakdown {
  printers: Array<{ key: string, count: number }>
  statuses: Array<{ key: string, count: number }>
  /**
   * How many logs were printed in each quarter hour, by UTC day: at most 96 a
   * day, however many logs there are. Every time zone is a whole number of
   * quarter hours from UTC, so the browser puts each slot in its own local
   * hour exactly, daylight saving included.
   */
  slots: Array<{ day: string, quarter: number, count: number }>
}

export function parsePrintLogListQuery(read: QueryReader): PrintLogListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 20 : Number(sizeText)
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100)
    return { error: 'per_page must be a whole number from 1 to 100.' }

  const sort = queryText(read, 'sort').toLowerCase() || 'newest'
  if (!(PRINT_LOG_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${PRINT_LOG_SORTS.join(', ')}.` }

  const range = queryText(read, 'range').toLowerCase() || '30'
  if (!(PRINT_LOG_RANGES as readonly string[]).includes(range))
    return { error: 'range must be 1, 7, 30, 90 or all.' }

  // `search` is what the page has always sent; `q` is what the other lists take.
  const search = queryText(read, 'search') || queryText(read, 'q')
  if (search.length > 200)
    return { error: 'search must be 200 characters or fewer.' }

  const printer = queryText(read, 'printer')
  if (printer.length > 100)
    return { error: 'printer must be 100 characters or fewer.' }

  const status = queryText(read, 'status').toLowerCase()
  if (status && !(PRINT_LOG_STATUSES as readonly string[]).includes(status))
    return { error: `status must be one of ${PRINT_LOG_STATUSES.join(', ')}.` }

  return {
    search,
    printer,
    status: status as PrintLogListQuery['status'],
    days: range === 'all' ? 0 : Number(range),
    sort: sort as PrintLogSort,
    page,
    perPage,
  }
}

/** The UTC day (YYYY-MM-DD) and quarter hour of that day (0 to 95) a log was printed in. */
function utcSlot(dialect: QueryBuilderDialect): { day: string, quarter: string } {
  if (dialect === 'sqlite') {
    return {
      day: `date(timestamp)`,
      quarter: `(CAST(strftime('%H', timestamp) AS INTEGER) * 4 + CAST(strftime('%M', timestamp) AS INTEGER) / 15)`,
    }
  }
  if (dialect === 'postgres') {
    // The model stores timestamptz; the cast also reads a text column.
    const utc = `(CAST(timestamp AS TIMESTAMPTZ) AT TIME ZONE 'UTC')`
    return {
      day: `CAST(CAST(${utc} AS DATE) AS TEXT)`,
      quarter: `(CAST(EXTRACT(HOUR FROM ${utc}) AS INTEGER) * 4 + CAST(EXTRACT(MINUTE FROM ${utc}) AS INTEGER) / 15)`,
    }
  }
  return { day: `CAST(DATE(timestamp) AS CHAR)`, quarter: '(HOUR(timestamp) * 4 + MINUTE(timestamp) DIV 15)' }
}

export function printLogFilter(query: Pick<PrintLogListQuery, 'search' | 'printer' | 'status' | 'days'>, dialect: QueryBuilderDialect, now: Date = new Date()): { where: string, values: unknown[] } {
  const { bind, values } = binder(dialect)
  const clauses: string[] = []
  if (query.printer)
    clauses.push(`printer = ${bind(query.printer)}`)
  if (query.status)
    // A text comparison: PostgreSQL keeps the status as an enum.
    clauses.push(`${asText('status', dialect)} = ${bind(query.status)}`)
  if (query.days > 0) {
    const cutoff = new Date(now.getTime() - query.days * 86_400_000)
    if (dialect === 'sqlite') {
      // SQLite keeps timestamps as text, where a time zone suffix or a "T"
      // makes plain text comparison wrong, so both sides go through datetime().
      clauses.push(`datetime(timestamp) >= datetime(${bind(sqlDateTime(cutoff))})`)
    }
    else if (dialect === 'postgres') {
      // The model stores timestamptz, which reads a value without a zone in the
      // session's time zone; the cutoff says it is UTC.
      clauses.push(`timestamp >= CAST(${bind(cutoff.toISOString())} AS TIMESTAMPTZ)`)
    }
    else {
      clauses.push(`timestamp >= ${bind(sqlDateTime(cutoff))}`)
    }
  }
  if (query.search) {
    const pattern = containsPattern(query.search)
    const columns = [`COALESCE(printer, '')`, 'document', asText('status', dialect)]
    clauses.push(`(${columns.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`)
  }
  return { where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', values }
}

function orderBy(sort: PrintLogSort, dialect: QueryBuilderDialect): string {
  // SQLite text timestamps with different zone suffixes do not sort as text;
  // julianday() reads each as the instant it is, milliseconds included.
  const at = dialect === 'sqlite' ? 'julianday(timestamp)' : 'timestamp'
  switch (sort) {
    case 'oldest': return ` ORDER BY ${at} ASC, id ASC`
    // Logs from one printer read newest first; the id breaks every remaining tie.
    case 'printer': return ` ORDER BY LOWER(COALESCE(printer, '')) ASC, ${at} DESC, id DESC`
    case 'duration': return ` ORDER BY duration DESC, ${at} DESC, id DESC`
    default: return ` ORDER BY ${at} DESC, id DESC`
  }
}

/** Logs turned into records, against exactly the print devices they reference. */
async function recordsFor(logs: Array<Record<string, unknown>>, run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<PrintLogRecord[]> {
  if (logs.length === 0)
    return []
  const deviceIds = referencedIds(logs, 'print_device_id')
  const devices = deviceIds.length > 0
    ? await run.unsafe(`SELECT id FROM print_devices WHERE id IN (${idPlaceholders(deviceIds, dialect)})`, deviceIds).execute()
    : []
  const known = new Set(sqlRows(devices).map(row => commerceIdentifier(commerceValue(row, 'id'), 'PrintDevice')))
  return logs.map(log => normalizePrintLogRecord(log, known))
}

/** The summary cards and breakdowns over every matching log, as summarizePrintLogs had them for a page. */
async function summarize(where: string, values: unknown[], run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<{ summary: PrintLogSummary, breakdown: PrintLogBreakdown }> {
  const status = asText('status', dialect)
  const count = (name: string) => `SUM(CASE WHEN ${status} = '${name}' THEN 1 ELSE 0 END)`
  const slot = utcSlot(dialect)
  const [totals, printers, statuses, slotRows] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count, ${count('success')} AS success_count, ${count('failed')} AS failed_count, ${count('warning')} AS warning_count, SUM(pages) AS page_total, SUM(CASE WHEN ${status} = 'success' THEN duration ELSE 0 END) AS success_duration FROM receipts${where}`, values).execute(),
    run.unsafe(`SELECT printer AS value, COUNT(*) AS item_count FROM receipts${where} GROUP BY printer`, values).execute(),
    run.unsafe(`SELECT ${status} AS value, COUNT(*) AS item_count FROM receipts${where} GROUP BY ${status}`, values).execute(),
    run.unsafe(`SELECT ${slot.day} AS day, ${slot.quarter} AS quarter, COUNT(*) AS item_count FROM receipts${where} GROUP BY ${slot.day}, ${slot.quarter}`, values).execute(),
  ])
  const row = sqlRows(totals)[0] ?? {}
  const total = countOf(row.total_count)
  const successful = countOf(row.success_count)
  const totalPages = countOf(row.page_total)
  const successDuration = countOf(row.success_duration)

  const tally = (result: unknown) => {
    const merged = new Map<string, number>()
    for (const entry of sqlRows(result)) {
      const key = String(entry.value ?? '').trim() || 'Unknown'
      merged.set(key, (merged.get(key) ?? 0) + countOf(entry.item_count))
    }
    return [...merged.entries()]
      .map(([key, value]) => ({ key, count: value }))
      .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
  }

  const slots = sqlRows(slotRows)
    .map(entry => ({ day: String(entry.day ?? '').slice(0, 10), quarter: Number(entry.quarter), count: countOf(entry.item_count) }))
    .filter(entry => /^\d{4}-\d{2}-\d{2}$/.test(entry.day) && Number.isInteger(entry.quarter) && entry.quarter >= 0 && entry.quarter < 96)
    .sort((left, right) => left.day.localeCompare(right.day) || left.quarter - right.quarter)

  return {
    summary: {
      total,
      successful,
      failed: countOf(row.failed_count),
      warnings: countOf(row.warning_count),
      successRate: total ? Math.round((successful / total) * 1000) / 10 : 0,
      totalPages,
      averagePages: total ? Math.round((totalPages / total) * 10) / 10 : 0,
      averageSuccessfulDuration: successful ? Math.round((successDuration / successful) * 10) / 10 : 0,
    },
    breakdown: { printers: tally(printers), statuses: tally(statuses), slots },
  }
}

/** The filter choices: every printer any log names, and every status. */
async function choices(run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<{ printers: string[], statuses: string[] }> {
  const [printers, statuses] = await Promise.all([
    run.unsafe(`SELECT DISTINCT printer AS value FROM receipts WHERE printer IS NOT NULL`).execute(),
    run.unsafe(`SELECT DISTINCT ${asText('status', dialect)} AS value FROM receipts`).execute(),
  ])
  const values = (result: unknown) => [...new Set(sqlRows(result).map(row => String(row.value ?? '').trim()).filter(Boolean))]
    .sort((left, right) => left.toLowerCase().localeCompare(right.toLowerCase()) || left.localeCompare(right))
  return {
    printers: values(printers),
    statuses: values(statuses).filter(value => (PRINT_LOG_STATUSES as readonly string[]).includes(value)),
  }
}

export interface PrintLogPage {
  records: PrintLogRecord[]
  summary: PrintLogSummary
  breakdown: PrintLogBreakdown
  pagination: { page: number, perPage: number, total: number, totalPages: number }
  options: { printers: string[], statuses: string[] }
}

export async function readPrintLogPage(
  query: PrintLogListQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  now: Date = new Date(),
): Promise<PrintLogPage> {
  const { where, values } = printLogFilter(query, dialect, now)
  const [{ summary, breakdown }, options] = await Promise.all([
    summarize(where, values, run, dialect),
    choices(run, dialect),
  ])
  const page = pageWithin(query.page, summary.total, query.perPage)
  const logs = await run.unsafe(
    `SELECT * FROM receipts${where}${orderBy(query.sort, dialect)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return {
    records: await recordsFor(sqlRows(logs), run, dialect),
    summary,
    breakdown,
    pagination: { page, perPage: query.perPage, total: summary.total, totalPages: Math.max(1, Math.ceil(summary.total / query.perPage)) },
    options,
  }
}

/** Every log matching the query, in its order, for the CSV export, a batch at a time. */
export async function readPrintLogsForExport(
  query: Omit<PrintLogListQuery, 'page' | 'perPage'>,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  now: Date = new Date(),
  batchSize: number = 500,
): Promise<PrintLogRecord[]> {
  const { where, values } = printLogFilter(query, dialect, now)
  const records: PrintLogRecord[] = []
  for (let offset = 0; ; offset += batchSize) {
    const batch = sqlRows(await run.unsafe(
      `SELECT * FROM receipts${where}${orderBy(query.sort, dialect)} LIMIT ${batchSize} OFFSET ${offset}`,
      values,
    ).execute())
    records.push(...await recordsFor(batch, run, dialect))
    if (batch.length < batchSize)
      return records
  }
}
