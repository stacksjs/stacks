import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { CommerceSqlRunner } from './commerce-sql'
import type { PaymentListQuery } from './commerce-payment-list'
import { parsePaymentListQuery, readPaymentPage, readPaymentsForExport } from './commerce-payment-list'

/**
 * The Payments list against each dialect's real engine (stacksjs/stacks#3218),
 * with status and method as real enum columns where the dialect has them.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const NOW = new Date('2026-11-06T12:00:00.000Z')
const STATUSES = ['completed', 'failed', 'pending', 'refunded', 'partiallyRefunded'] as const
const METHODS = ['creditCard', 'paypal', 'cash'] as const

/** 24 payments, one every 20 hours back from NOW, each for an order. */
const PAYMENTS = Array.from({ length: 24 }, (_, index) => {
  const id = index + 1
  const status = STATUSES[id % STATUSES.length]!
  const amount = 1000 + id * 50
  return {
    id,
    amount,
    refund_amount: status === 'refunded' ? amount : status === 'partiallyRefunded' ? 200 : null,
    method: METHODS[id % METHODS.length]!,
    status,
    currency: id % 6 === 0 ? 'usd' : (id % 2 === 0 ? 'USD' : 'EUR'),
    billing_email: id === 7 ? 'pay_100%@shop.test' : `buyer${id}@example.com`,
    order_id: id + 700,
    hoursAgo: index * 20,
  }
})

const SUCCESSFUL = new Set(['completed', 'succeeded', 'partiallyRefunded', 'refunded'])

function within(days: number) {
  return PAYMENTS.filter(payment => days === 0 || payment.hoursAgo * 3_600_000 <= days * 86_400_000)
}

function query(overrides: Partial<PaymentListQuery> = {}): PaymentListQuery {
  return { search: '', status: '', method: '', days: 0, sort: 'created', direction: 'desc', page: 1, perPage: 10, ...overrides }
}

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  let statusType = text
  let methodType = text
  if (dialect === 'postgres') {
    await run(`CREATE TYPE payment_status AS ENUM (${[...STATUSES, 'succeeded', 'processing'].map(s => `'${s}'`).join(', ')})`)
    await run(`CREATE TYPE payment_method AS ENUM (${METHODS.map(m => `'${m}'`).join(', ')})`)
    statusType = 'payment_status'
    methodType = 'payment_method'
  }
  if (dialect === 'mysql') {
    statusType = `ENUM(${[...STATUSES, 'succeeded', 'processing'].map(s => `'${s}'`).join(', ')})`
    methodType = `ENUM(${METHODS.map(m => `'${m}'`).join(', ')})`
  }
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  await run(`CREATE TABLE orders (id ${pk})`)
  await run(`CREATE TABLE customers (id ${pk})`)
  await run(`CREATE TABLE payments (id ${pk}, amount INTEGER, refund_amount INTEGER NULL, method ${methodType}, status ${statusType}, currency ${text}, reference_number ${text} NULL, card_last_four ${text} NULL, card_brand ${text} NULL, billing_email ${text} NULL, transaction_id ${text} NULL, payment_provider ${text} NULL, notes ${text} NULL, order_id INTEGER NULL, customer_id INTEGER NULL, created_at ${time})`)
  const p = (count: number) => Array.from({ length: count }, (_, i) => dialect === 'postgres' ? `$${i + 1}` : '?').join(', ')
  for (const payment of PAYMENTS)
    await run(`INSERT INTO orders (id) VALUES (${p(1)})`, [payment.order_id])
  for (const payment of PAYMENTS) {
    const at = new Date(NOW.getTime() - payment.hoursAgo * 3_600_000).toISOString().slice(0, 19)
    // SQLite gets both text forms, which compare wrongly as plain text.
    const created = dialect === 'sqlite' && payment.id % 2 === 0 ? at.replace('T', ' ') : at.replace('T', dialect === 'sqlite' ? 'T' : ' ')
    await run(
      `INSERT INTO payments (id, amount, refund_amount, method, status, currency, billing_email, order_id, created_at) VALUES (${p(9)})`,
      [payment.id, payment.amount, payment.refund_amount, payment.method, payment.status, payment.currency, payment.billing_email, payment.order_id, created],
    )
  }
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const read = (overrides: Partial<PaymentListQuery> = {}) => readPaymentPage(query(overrides), runner, dialect, NOW)

  // Every time range counts exactly the payments inside it.
  for (const days of [1, 7, 30, 0] as const)
    expect((await read({ days })).total).toBe(within(days).length)

  // The summary and breakdown describe the matching set, not the page.
  const week = await read({ days: 7, perPage: 10 })
  const inWeek = within(7)
  expect(week.records.length).toBeLessThanOrEqual(10)
  expect(week.summary.total).toBe(inWeek.length)
  const successful = inWeek.filter(payment => SUCCESSFUL.has(payment.status))
  const failed = inWeek.filter(payment => payment.status === 'failed')
  expect(week.summary.successful).toBe(successful.length)
  expect(week.summary.successRate).toBe(Math.round((successful.length / (successful.length + failed.length)) * 1000) / 10)
  const captured = (currency: string) => successful.filter(payment => payment.currency.toUpperCase() === currency).reduce((sum, payment) => sum + payment.amount, 0)
  expect(week.summary.capturedByCurrency.USD).toBe(captured('USD'))
  expect(week.summary.capturedByCurrency.EUR).toBe(captured('EUR'))
  expect(week.summary.currencies).toEqual(['EUR', 'USD'])
  const statusCounts = Object.fromEntries(week.breakdown.statuses.map(row => [row.key, row.count]))
  for (const status of new Set(inWeek.map(payment => payment.status)))
    expect(statusCounts[status]).toBe(inWeek.filter(payment => payment.status === status).length)

  // Newest first with id breaking ties, stable across pages.
  const all = [...PAYMENTS].sort((a, b) => a.hoursAgo - b.hoursAgo || b.id - a.id).map(payment => String(payment.id))
  const pages = [await read({ page: 1 }), await read({ page: 2 }), await read({ page: 3 })]
  expect(pages.flatMap(result => result.records.map(record => record.id))).toEqual(all)
  expect((await read({ page: 9 })).page).toBe(3)

  // Filters on the enum columns, and a value no payment has, which is no match rather than an error.
  expect((await read({ status: 'failed', perPage: 100 })).total).toBe(PAYMENTS.filter(payment => payment.status === 'failed').length)
  expect((await read({ method: 'paypal', perPage: 100 })).total).toBe(PAYMENTS.filter(payment => payment.method === 'paypal').length)
  expect((await read({ status: 'not-a-status' })).total).toBe(0)

  // Search: enum text in any case, email with a literal %, and the order id.
  expect((await read({ search: 'PAYPAL', perPage: 100 })).total).toBe(PAYMENTS.filter(payment => payment.method === 'paypal').length)
  expect((await read({ search: '100%' })).records.map(record => record.id)).toEqual(['7'])
  expect((await read({ search: '712' })).records.map(record => record.id)).toEqual(['12'])

  // Amount sorts high first; status sorts by name, newest first within one.
  const amounts = (await read({ sort: 'amount', direction: 'desc', perPage: 100 })).records.map(record => record.amount)
  expect(amounts).toEqual([...amounts].sort((a, b) => b - a))
  const byStatus = (await read({ sort: 'status', direction: 'asc', perPage: 100 })).records.map(record => record.status)
  expect(byStatus).toEqual([...byStatus].sort())

  // The export holds every match across batches, in order.
  const exported = await readPaymentsForExport({ search: '', status: '', method: '', days: 0, sort: 'created', direction: 'desc' }, runner, dialect, NOW, 5)
  expect(exported.map(record => record.id)).toEqual(all)
}

describe('readPaymentPage on SQLite', () => {
  test('ranges, summary, breakdown, filters, search, sorts, pages and export', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readPaymentPage on ${dialect}: ranges, summary, breakdown, filters, search, sorts, pages and export`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Payment list tests require a local disposable database server')

    const name = `stacks_payment_list_${crypto.randomUUID().replaceAll('-', '')}`
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

describe('parsePaymentListQuery', () => {
  const reader = (values: Record<string, unknown>) => (key: string) => values[key] ?? ''

  test('defaults to every payment, newest first, 25 a page', () => {
    expect(parsePaymentListQuery(reader({}))).toEqual({ search: '', status: '', method: '', days: 0, sort: 'created', direction: 'desc', page: 1, perPage: 25 })
    expect(parsePaymentListQuery(reader({ days: 'all' }))).toHaveProperty('days', 0)
  })

  test('accepts only the ranges the page offers', () => {
    expect(parsePaymentListQuery(reader({ days: '30' }))).toHaveProperty('days', 30)
    expect(parsePaymentListQuery(reader({ days: '45' }))).toHaveProperty('error')
    expect(parsePaymentListQuery(reader({ sort: 'card_last_four' }))).toHaveProperty('error')
  })
})
