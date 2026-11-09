import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { CustomerListQuery } from './commerce-customer-list'
import { customersCsv, parseCustomerListQuery, readCustomerPage, readCustomersForExport } from './commerce-customer-list'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The customers against each dialect's real engine (stacksjs/stacks#3218),
 * over 520 of them: the page used to read the first 500 by name.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'
type Run = (sql: string, values?: unknown[]) => Promise<unknown>

const ROWS = 520
const pad = (value: number) => String(value).padStart(3, '0')

/**
 * Names run opposite to ids, every third in lower case; every fifth has no
 * phone; every fourth never ordered and every fourth after it has an empty
 * last order; every third is Inactive; spend repeats, so ties are broken.
 */
const CUSTOMERS = Array.from({ length: ROWS }, (_, index) => {
  const id = index + 1
  const name = id === 7 ? 'Ann 100% Cotton' : `${id % 3 === 0 ? 'customer' : 'Customer'} ${pad(ROWS + 1 - id)}`
  return {
    id,
    name,
    email: `buyer${id}@shop.test`,
    phone: id % 5 === 0 ? null : `+1 555 ${pad(id)}`,
    spent: (id * 37) % 1000,
    lastOrder: id % 4 === 0 ? null : id % 4 === 1 ? '' : `2026-10-${String((id % 28) + 1).padStart(2, '0')}`,
    status: id % 3 === 0 ? 'Inactive' : 'Active',
  }
})
type Customer = typeof CUSTOMERS[number]

function query(overrides: Partial<CustomerListQuery> = {}): CustomerListQuery {
  return { search: '', status: '', sort: 'name', direction: 'asc', page: 1, perPage: 25, ...overrides }
}

/** The order the database is asked for, in plain code. */
function ordered(rows: Customer[], sort: CustomerListQuery['sort'], direction: 'asc' | 'desc'): Customer[] {
  const sign = direction === 'asc' ? 1 : -1
  const compare = (left: string | number, right: string | number) => left < right ? -1 : left > right ? 1 : 0
  const key = (customer: Customer): string | number => {
    switch (sort) {
      case 'spend': return customer.spent
      case 'last-order': return customer.lastOrder ?? ''
      case 'status': return customer.status
      case 'newest': return customer.id
      default: return customer.name.toLowerCase()
    }
  }
  return [...rows].sort((left, right) => {
    if (sort === 'last-order') {
      const unordered = Number(!left.lastOrder) - Number(!right.lastOrder)
      if (unordered !== 0)
        return unordered
    }
    return sign * compare(key(left), key(right))
      || (sort === 'name' || sort === 'newest' ? 0 : compare(left.name.toLowerCase(), right.name.toLowerCase()))
      || sign * (left.id - right.id)
  })
}

const ids = (rows: Customer[]) => rows.map(customer => String(customer.id))

async function setUp(run: Run, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  const columns = 9
  await run(`CREATE TABLE customers (id ${pk}, name ${text}, email ${text}, phone ${text} NULL, total_spent INTEGER, last_order ${text} NULL, status ${text}, avatar ${text}, created_at ${time})`)
  await run(
    `INSERT INTO customers (id, name, email, phone, total_spent, last_order, status, avatar, created_at) VALUES ${CUSTOMERS.map((_, i) => `(${Array.from({ length: columns }, (_, c) => p(i * columns + c + 1)).join(', ')})`).join(', ')}`,
    CUSTOMERS.flatMap(customer => [
      customer.id, customer.name, customer.email, customer.phone, customer.spent, customer.lastOrder, customer.status,
      `https://example.test/${customer.id}.jpg`, '2026-11-01 09:00:00',
    ]),
  )
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const page = (overrides: Partial<CustomerListQuery> = {}) => readCustomerPage(query(overrides), runner, dialect)
  const idsOf = (result: { records: Array<{ id: string }> }) => result.records.map(record => record.id)

  // By name, every one of them, the last page past the 500th.
  const byName = ordered(CUSTOMERS, 'name', 'asc')
  const first = await page()
  expect(first.total).toBe(ROWS)
  expect(idsOf(first)).toEqual(ids(byName.slice(0, 25)))
  expect(idsOf(await page({ page: 21 }))).toEqual(ids(byName.slice(500)))
  expect((await page({ page: 99 })).page).toBe(21)

  // The summary is over every customer.
  expect(first.summary).toEqual({
    total: ROWS,
    active: CUSTOMERS.filter(customer => customer.status === 'Active').length,
    inactive: CUSTOMERS.filter(customer => customer.status === 'Inactive').length,
    totalSpent: CUSTOMERS.reduce((sum, customer) => sum + customer.spent, 0),
    averageSpent: CUSTOMERS.reduce((sum, customer) => sum + customer.spent, 0) / ROWS,
  })

  // The status filter and the search, over name, email and phone, % taken literally.
  const inactive = CUSTOMERS.filter(customer => customer.status === 'Inactive')
  expect((await page({ status: 'Inactive', perPage: 200 })).records.map(record => record.id)).toEqual(ids(ordered(inactive, 'name', 'asc')).slice(0, 200))
  expect(idsOf(await page({ search: '100%' }))).toEqual(['7'])
  expect(idsOf(await page({ search: 'BUYER519@' }))).toEqual(['519'])
  expect(idsOf(await page({ search: '555 512' }))).toEqual(['512'])
  expect((await page({ search: 'customer 00' })).total).toBe(9)

  // Every sort, both ways, ties broken by name and then id.
  for (const sort of ['spend', 'last-order', 'status', 'newest'] as const) {
    for (const direction of ['asc', 'desc'] as const)
      expect(idsOf(await page({ sort, direction, perPage: 100, page: 6 }))).toEqual(ids(ordered(CUSTOMERS, sort, direction).slice(500)))
  }
  // Customers who never ordered come last, whichever way.
  const latest = await page({ sort: 'last-order', direction: 'desc', perPage: 10 })
  expect(latest.records.every(record => record.lastOrder !== '')).toBe(true)

  // The export: every matching customer in the page's order, a batch at a time.
  const exported = await readCustomersForExport({ search: '', status: 'Inactive', sort: 'spend', direction: 'desc' }, runner, dialect, 50)
  expect(exported.map(record => record.id)).toEqual(ids(ordered(inactive, 'spend', 'desc')))
  const csv = customersCsv(exported.slice(0, 1), 'EUR', (amount, currency) => `${amount} ${currency}`)
  const top = ordered(inactive, 'spend', 'desc')[0]!
  expect(csv.charCodeAt(0)).toBe(0xFEFF)
  expect(csv.slice(1).split('\n')).toEqual([
    '"Name","Email","Phone","Status","Total spent (EUR)","Last order","Avatar URL"',
    `"${top.name}","${top.email}","${top.phone ?? ''}","Inactive","${top.spent} EUR","${exported[0]!.lastOrder}","https://example.test/${top.id}.jpg"`,
  ])
}

describe('parseCustomerListQuery', () => {
  test('defaults and refusals', () => {
    const read = (values: Record<string, string>) => parseCustomerListQuery(key => values[key] ?? '')
    expect(read({})).toEqual(query())
    expect(read({ sort: 'spend' })).toMatchObject({ sort: 'spend', direction: 'desc' })
    expect(read({ sort: 'last-order' })).toMatchObject({ direction: 'desc' })
    expect(read({ status: 'Unknown' })).toEqual({ error: 'status must be one of Active, Inactive.' })
    expect(read({ sort: 'phone' })).toHaveProperty('error')
    expect(read({ per_page: '7' })).toHaveProperty('error')
    expect(read({ page: '0' })).toHaveProperty('error')
  })
})

describe('readCustomerPage on SQLite', () => {
  test('search, filter, sorts, pages, summary and export', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readCustomerPage on ${dialect}: search, filter, sorts, pages, summary and export`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Customer list tests require a local disposable database server')

    const name = `stacks_customers_${crypto.randomUUID().replaceAll('-', '')}`
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    const admin = new SQL({ url: url.href, database: decodeURIComponent(url.pathname.slice(1)) || undefined })
    await admin.unsafe(`CREATE DATABASE ${quoted}`)
    const scoped = new URL(url.href)
    scoped.pathname = `/${name}`
    // Explicit database wins over inherited PGDATABASE / MYSQL_DATABASE in CI.
    const database = new SQL({ url: scoped.href, database: name })

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
