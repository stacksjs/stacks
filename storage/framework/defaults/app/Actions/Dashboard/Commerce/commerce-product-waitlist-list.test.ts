import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { ProductWaitlistListQuery } from './commerce-product-waitlist-list'
import { parseProductWaitlistListQuery, readProductWaitlistPage } from './commerce-product-waitlist-list'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The product waitlist against each dialect's real engine
 * (stacksjs/stacks#3218), with status and preference as real enums, and
 * products and customers past the 500 the page used to read.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const NOW = new Date('2026-11-06T12:00:00.000Z')
const ROWS = 600
const STATUSES = ['waiting', 'notified', 'purchased', 'cancelled'] as const
const PREFERENCES = ['sms', 'email', 'both'] as const
const PRODUCT_NAMES: Record<number, string> = { 1: 'Coffee Beans', 2: 'apron', 600: 'zebra Tea' }
const productName = (id: number) => PRODUCT_NAMES[id] ?? `Product ${id}`
const NAMES = ['ann', 'Ben', 'cat', 'Dan', 'eve']

/** 26 entries, one an hour back from NOW; 14 and 15 share a creation time. */
const ENTRIES = Array.from({ length: 26 }, (_, index) => {
  const id = index + 1
  return {
    id,
    name: id === 9 ? 'Sale_100% Fan' : id === 10 ? 'Sale 1000 Fan' : NAMES[id % NAMES.length]!,
    email: `waiter${id}@shop.test`,
    phone: id === 21 ? '+1 555 0199' : null,
    quantity: (id * 3) % 7 + 1,
    notification_preference: PREFERENCES[id % PREFERENCES.length]!,
    source: id === 17 ? 'in-store' : 'website',
    status: STATUSES[id % STATUSES.length]!,
    product_id: [1, 2, 600][id % 3]!,
    customer_id: id % 5 === 0 ? 599 : null,
    hoursAgo: id === 15 ? 14 : id,
  }
})
type Entry = typeof ENTRIES[number]

const ids = (entries: Entry[]) => entries.map(entry => String(entry.id))
const newestFirst = (a: Entry, b: Entry) => a.hoursAgo - b.hoursAgo || b.id - a.id

function query(overrides: Partial<ProductWaitlistListQuery> = {}): ProductWaitlistListQuery {
  return { search: '', status: '', sort: 'created', direction: 'desc', page: 1, perPage: 10, ...overrides }
}

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  let statusType = text
  let preferenceType = text
  if (dialect === 'postgres') {
    // Declared out of alphabetical order, so a sort that forgets the text cast shows.
    await run(`CREATE TYPE waitlist_status AS ENUM ('waiting', 'notified', 'purchased', 'cancelled')`)
    await run(`CREATE TYPE waitlist_preference AS ENUM ('sms', 'email', 'both')`)
    statusType = 'waitlist_status'
    preferenceType = 'waitlist_preference'
  }
  if (dialect === 'mysql') {
    statusType = `ENUM('waiting', 'notified', 'purchased', 'cancelled')`
    preferenceType = `ENUM('sms', 'email', 'both')`
  }
  await run(`CREATE TABLE products (id ${pk}, name ${text})`)
  await run(`CREATE TABLE customers (id ${pk})`)
  await run(`CREATE TABLE waitlist_products (id ${pk}, name ${text}, email ${text}, phone ${text} NULL, quantity INTEGER, notification_preference ${preferenceType}, source ${text}, notes ${text} NULL, status ${statusType}, product_id INTEGER NULL, customer_id INTEGER NULL, created_at ${time})`)
  const all = Array.from({ length: ROWS }, (_, i) => i + 1)
  await run(`INSERT INTO products (id, name) VALUES ${all.map((_, i) => `(${p(2 * i + 1)}, ${p(2 * i + 2)})`).join(', ')}`, all.flatMap(id => [id, productName(id)]))
  await run(`INSERT INTO customers (id) VALUES ${all.map((_, i) => `(${p(i + 1)})`).join(', ')}`, all)
  for (const entry of ENTRIES) {
    await run(
      `INSERT INTO waitlist_products (id, name, email, phone, quantity, notification_preference, source, status, product_id, customer_id, created_at) VALUES (${Array.from({ length: 11 }, (_, i) => p(i + 1)).join(', ')})`,
      [
        entry.id, entry.name, entry.email, entry.phone, entry.quantity, entry.notification_preference, entry.source, entry.status,
        entry.product_id, entry.customer_id, new Date(NOW.getTime() - entry.hoursAgo * 3_600_000).toISOString().slice(0, 19).replace('T', ' '),
      ],
    )
  }
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const read = (overrides: Partial<ProductWaitlistListQuery> = {}) => readProductWaitlistPage(query(overrides), runner, dialect)
  const all = async (overrides: Partial<ProductWaitlistListQuery> = {}) => (await read({ perPage: 100, ...overrides })).records.map(record => record.id)
  const matching = (keep: (entry: Entry) => boolean) => ids(ENTRIES.filter(keep).sort(newestFirst))

  // The summary counts every entry, whatever the page is filtered to.
  const filtered = await read({ status: 'cancelled' })
  const purchased = ENTRIES.filter(entry => entry.status === 'purchased').length
  expect(filtered.summary).toEqual({
    total: ENTRIES.length,
    waiting: ENTRIES.filter(entry => entry.status === 'waiting').length,
    notified: ENTRIES.filter(entry => entry.status === 'notified').length,
    purchased,
    conversionRate: Math.round((purchased / ENTRIES.length) * 100),
  })
  expect(filtered.total).toBe(ENTRIES.filter(entry => entry.status === 'cancelled').length)

  // Search: name with a literal %, email, phone, source, product name and id, ignoring case.
  expect(await all({ search: '100%' })).toEqual(['9'])
  expect(await all({ search: 'WAITER21@' })).toEqual(['21'])
  expect(await all({ search: '0199' })).toEqual(['21'])
  expect(await all({ search: 'IN-STORE' })).toEqual(['17'])
  expect(await all({ search: 'ZEBRA' })).toEqual(matching(entry => entry.product_id === 600))
  expect(await all({ search: 'zebra', status: 'waiting' })).toEqual(matching(entry => entry.product_id === 600 && entry.status === 'waiting'))

  // Newest first, the id breaking the tie between 14 and 15, stable across pages.
  const newest = [...ENTRIES].sort(newestFirst)
  const pages = [await read({ page: 1 }), await read({ page: 2 }), await read({ page: 3 })]
  expect(pages.flatMap(result => result.records.map(record => record.id))).toEqual(ids(newest))
  expect((await read({ page: 9 })).page).toBe(3)

  // Sorts, ties newest first. Status and preference sort by name, not enum order.
  const by = (key: (entry: Entry) => string | number, direction: 1 | -1 = 1) => (a: Entry, b: Entry) => {
    const left = key(a)
    const right = key(b)
    const order = typeof left === 'number' ? (left - (right as number)) : left.localeCompare(right as string)
    return order * direction || newestFirst(a, b)
  }
  expect(await all({ sort: 'name', direction: 'asc' })).toEqual(ids([...ENTRIES].sort(by(entry => entry.name.toLowerCase()))))
  expect(await all({ sort: 'product', direction: 'asc' })).toEqual(ids([...ENTRIES].sort(by(entry => productName(entry.product_id).toLowerCase()))))
  expect(await all({ sort: 'quantity', direction: 'desc' })).toEqual(ids([...ENTRIES].sort(by(entry => entry.quantity, -1))))
  expect(await all({ sort: 'status', direction: 'asc' })).toEqual(ids([...ENTRIES].sort(by(entry => entry.status))))
  expect(await all({ sort: 'preference', direction: 'asc' })).toEqual(ids([...ENTRIES].sort(by(entry => entry.notification_preference))))

  // Products and customers past the 500th, read by the ids the page references.
  const records = (await read({ perPage: 100 })).records
  expect(records.find(record => record.productId === '600')).toMatchObject({ productName: 'zebra Tea' })
  expect(records.find(record => record.customerId === '599')).toBeDefined()
}

describe('readProductWaitlistPage on SQLite', () => {
  test('summary, filters, search, sorts, pages and references', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readProductWaitlistPage on ${dialect}: summary, filters, search, sorts, pages and references`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Product waitlist list tests require a local disposable database server')

    const name = `stacks_product_waitlist_${crypto.randomUUID().replaceAll('-', '')}`
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

describe('parseProductWaitlistListQuery', () => {
  const reader = (values: Record<string, unknown>) => (key: string) => values[key] ?? ''

  test('defaults to every entry, newest first, 25 a page', () => {
    expect(parseProductWaitlistListQuery(reader({}))).toEqual({ search: '', status: '', sort: 'created', direction: 'desc', page: 1, perPage: 25 })
    expect(parseProductWaitlistListQuery(reader({ sort: 'name' }))).toHaveProperty('direction', 'asc')
  })

  test('refuses values the page does not offer', () => {
    expect(parseProductWaitlistListQuery(reader({ status: 'seated' }))).toHaveProperty('error')
    expect(parseProductWaitlistListQuery(reader({ sort: 'notes' }))).toHaveProperty('error')
  })
})
