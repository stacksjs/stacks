import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { PrintLogListQuery } from './commerce-print-log-list'
import { parsePrintLogListQuery, readPrintLogPage, readPrintLogsForExport } from './commerce-print-log-list'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The print logs against each dialect's real engine (stacksjs/stacks#3218):
 * status as a real enum, timestamps as each dialect stores them (SQLite text
 * with a time zone suffix, PostgreSQL timestamptz, MySQL DATETIME in UTC), and
 * print devices past the 500 the page used to read.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const NOW = new Date('2026-11-06T12:00:00.000Z')
const HOUR = 3_600_000
const DEVICES = 520
const STATUSES = ['success', 'failed', 'warning'] as const
const PRINTERS = ['Kitchen', 'bar printer', 'Front Desk', null] as const

/** 40 logs, 7 hours 13 minutes apart back from NOW; the last few are over 30 days old. */
const LOGS = Array.from({ length: 40 }, (_, index) => {
  const id = index + 1
  return {
    id,
    printer: id === 9 ? 'Laser_100%' : id === 10 ? 'Laser 1000' : PRINTERS[id % PRINTERS.length]!,
    document: `Receipt R-${String(id).padStart(4, '0')}`,
    at: NOW.getTime() - id * (7 * HOUR + 13 * 60_000) - (id > 36 ? 30 * 24 * HOUR : 0),
    status: STATUSES[id % 3]!,
    pages: id % 6,
    duration: (id * 7) % 11,
    deviceId: id % 5 === 0 ? 515 : null,
  }
})
type Log = typeof LOGS[number]

const ids = (logs: Log[]) => logs.map(log => String(log.id))
const newestFirst = (a: Log, b: Log) => b.at - a.at || b.id - a.id
const within = (days: number) => LOGS.filter(log => days === 0 || NOW.getTime() - log.at <= days * 24 * HOUR)

function query(overrides: Partial<PrintLogListQuery> = {}): PrintLogListQuery {
  return { search: '', printer: '', status: '', days: 0, sort: 'newest', page: 1, perPage: 10, ...overrides }
}

/** A timestamp as each dialect stores one; SQLite alternates UTC and +08:00 text. */
function stored(log: Log, dialect: Dialect): string {
  const date = new Date(log.at)
  // PostgreSQL gets the zone: timestamptz reads a bare value in the session's
  // time zone, which on a developer's machine is rarely UTC.
  if (dialect === 'postgres')
    return date.toISOString()
  if (dialect === 'mysql')
    return date.toISOString().slice(0, 23).replace('T', ' ')
  if (log.id % 2 === 0)
    return date.toISOString()
  const shifted = new Date(log.at + 8 * HOUR).toISOString().slice(0, 23)
  return `${shifted}+08:00`
}

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMPTZ'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  const rows = (count: number, columns: number) => Array.from({ length: count }, (_, i) => `(${Array.from({ length: columns }, (_, c) => p(i * columns + c + 1)).join(', ')})`).join(', ')
  let status = text
  if (dialect === 'postgres') {
    await run(`CREATE TYPE receipt_status AS ENUM ('success', 'failed', 'warning')`)
    status = 'receipt_status'
  }
  if (dialect === 'mysql')
    status = `ENUM('success', 'failed', 'warning')`
  await run(`CREATE TABLE print_devices (id ${pk})`)
  await run(`CREATE TABLE receipts (id ${pk}, printer ${text} NULL, document ${text}, timestamp ${time}, status ${status}, size INTEGER, pages INTEGER, duration INTEGER, metadata ${text} NULL, print_device_id INTEGER NULL, created_at ${time})`)
  const all = Array.from({ length: DEVICES }, (_, i) => i + 1)
  await run(`INSERT INTO print_devices (id) VALUES ${rows(DEVICES, 1)}`, all)
  await run(
    `INSERT INTO receipts (id, printer, document, timestamp, status, size, pages, duration, print_device_id, created_at) VALUES ${rows(LOGS.length, 10)}`,
    LOGS.flatMap(log => [log.id, log.printer, log.document, stored(log, dialect), log.status, 4, log.pages, log.duration, log.deviceId, stored(log, dialect)]),
  )
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const read = (overrides: Partial<PrintLogListQuery> = {}) => readPrintLogPage(query(overrides), runner, dialect, NOW)
  const all = async (overrides: Partial<PrintLogListQuery> = {}) => (await read({ perPage: 100, ...overrides })).records.map(record => record.id)

  // The summary and breakdown describe every matching log, not the page.
  const month = await read({ days: 30 })
  const inMonth = within(30)
  const successful = inMonth.filter(log => log.status === 'success')
  const pages = inMonth.reduce((sum, log) => sum + log.pages, 0)
  expect(month.records.length).toBe(10)
  expect(month.summary).toEqual({
    total: inMonth.length,
    successful: successful.length,
    failed: inMonth.filter(log => log.status === 'failed').length,
    warnings: inMonth.filter(log => log.status === 'warning').length,
    successRate: Math.round((successful.length / inMonth.length) * 1000) / 10,
    totalPages: pages,
    averagePages: Math.round((pages / inMonth.length) * 10) / 10,
    averageSuccessfulDuration: Math.round((successful.reduce((sum, log) => sum + log.duration, 0) / successful.length) * 10) / 10,
  })
  expect(month.pagination).toEqual({ page: 1, perPage: 10, total: inMonth.length, totalPages: Math.ceil(inMonth.length / 10) })
  const printerCounts = Object.fromEntries(month.breakdown.printers.map(row => [row.key, row.count]))
  expect(printerCounts.Kitchen).toBe(inMonth.filter(log => log.printer === 'Kitchen').length)
  expect(printerCounts.Unknown).toBe(inMonth.filter(log => log.printer === null).length)
  expect(Object.fromEntries(month.breakdown.statuses.map(row => [row.key, row.count])).failed).toBe(inMonth.filter(log => log.status === 'failed').length)

  // UTC day and quarter hour, whatever zone each dialect stored the time in.
  const slots = new Map<string, { day: string, quarter: number, count: number }>()
  for (const log of inMonth) {
    const date = new Date(log.at)
    const day = date.toISOString().slice(0, 10)
    const quarter = date.getUTCHours() * 4 + Math.floor(date.getUTCMinutes() / 15)
    const slot = slots.get(`${day}:${quarter}`) ?? { day, quarter, count: 0 }
    slot.count += 1
    slots.set(`${day}:${quarter}`, slot)
  }
  expect(month.breakdown.slots).toEqual([...slots.values()].sort((a, b) => a.day.localeCompare(b.day) || a.quarter - b.quarter))

  // Filters, the time range, and a search that ignores case and treats % literally.
  expect((await read({ days: 0 })).summary.total).toBe(LOGS.length)
  expect((await read({ days: 1 })).summary.total).toBe(within(1).length)
  expect(await all({ status: 'warning' })).toEqual(ids(LOGS.filter(log => log.status === 'warning').sort(newestFirst)))
  expect(await all({ printer: 'Kitchen' })).toEqual(ids(LOGS.filter(log => log.printer === 'Kitchen').sort(newestFirst)))
  expect(await all({ search: '100%' })).toEqual(['9'])
  expect(await all({ search: 'BAR PRINTER' })).toEqual(ids(LOGS.filter(log => log.printer === 'bar printer').sort(newestFirst)))
  expect(await all({ search: 'r-0012' })).toEqual(['12'])

  // Sorts, stable across pages.
  const newest = [...LOGS].sort(newestFirst)
  const paged = [await read({ page: 1 }), await read({ page: 2 }), await read({ page: 3 }), await read({ page: 4 })]
  expect(paged.flatMap(result => result.records.map(record => record.id))).toEqual(ids(newest))
  expect((await read({ page: 9 })).pagination.page).toBe(4)
  expect(await all({ sort: 'oldest' })).toEqual(ids([...LOGS].sort((a, b) => a.at - b.at || a.id - b.id)))
  const printerKey = (log: Log) => (log.printer ?? '').toLowerCase()
  expect(await all({ sort: 'printer' })).toEqual(ids([...LOGS].sort((a, b) => printerKey(a).localeCompare(printerKey(b)) || newestFirst(a, b))))
  expect(await all({ sort: 'duration' })).toEqual(ids([...LOGS].sort((a, b) => b.duration - a.duration || newestFirst(a, b))))

  // Print devices past the 500th, and every printer as a choice, by name ignoring case.
  expect(month.records.some(record => record.printDeviceId === '515') || (await read({ perPage: 100 })).records.some(record => record.printDeviceId === '515')).toBe(true)
  expect(month.options.printers).toEqual(['bar printer', 'Front Desk', 'Kitchen', 'Laser 1000', 'Laser_100%'])
  expect(month.options.statuses.sort()).toEqual(['failed', 'success', 'warning'])

  // The export holds every match across batches, in order.
  const exported = await readPrintLogsForExport({ search: '', printer: '', status: '', days: 0, sort: 'newest' }, runner, dialect, NOW, 7)
  expect(exported.map(record => record.id)).toEqual(ids(newest))
}

describe('readPrintLogPage on SQLite', () => {
  test('summary, breakdown, filters, search, sorts, pages, devices and export', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readPrintLogPage on ${dialect}: summary, breakdown, filters, search, sorts, pages, devices and export`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Print log list tests require a local disposable database server')

    const name = `stacks_print_logs_${crypto.randomUUID().replaceAll('-', '')}`
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    const admin = new SQL(url.href)
    await admin.unsafe(`CREATE DATABASE ${quoted}`)
    const scoped = new URL(url.href)
    scoped.pathname = `/${name}`
    const database = new SQL(scoped.href)

    try {
      await setUp(async (sql, values = []) => await database.unsafe(sql, values), dialect)
      await exercise({ unsafe: (sql, values = []) => ({ execute: async () => await database.unsafe(sql, values) }) }, dialect)
    }
    finally {
      await database.close()
      try { await admin.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
      finally { await admin.close() }
    }
  }, 60_000)
}

describe('parsePrintLogListQuery', () => {
  const reader = (values: Record<string, unknown>) => (key: string) => values[key] ?? ''

  test('defaults to the last 30 days, newest first, 20 a page', () => {
    expect(parsePrintLogListQuery(reader({}))).toEqual({ search: '', printer: '', status: '', days: 30, sort: 'newest', page: 1, perPage: 20 })
    expect(parsePrintLogListQuery(reader({ range: 'all', search: 'kitchen' }))).toMatchObject({ days: 0, search: 'kitchen' })
  })

  test('refuses values the page does not offer', () => {
    expect(parsePrintLogListQuery(reader({ status: 'printing' }))).toHaveProperty('error')
    expect(parsePrintLogListQuery(reader({ range: '45' }))).toHaveProperty('error')
    expect(parsePrintLogListQuery(reader({ sort: 'pages' }))).toHaveProperty('error')
    expect(parsePrintLogListQuery(reader({ per_page: '500' }))).toHaveProperty('error')
  })
})
