import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { LicenseKeyListQuery } from './commerce-license-key-list'
import { parseLicenseKeyListQuery, readLicenseKeyPage, searchLicenseKeyChoices } from './commerce-license-key-list'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The Licence Keys list and its dialog's choices against each dialect's real
 * engine (stacksjs/stacks#3218), with template and status as real enums, over
 * 520 customers, products and orders: the page used to read the first 500 of
 * each.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const NOW = new Date('2026-11-06T12:00:00.000Z')
const DAY = 86_400_000
const ROWS = 520
const TEMPLATES = ['Standard License', 'Premium License', 'Enterprise License'] as const
const STATUSES = ['active', 'inactive', 'unassigned'] as const
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
const customerName = (id: number) => id === 515 ? 'zelda Late' : id === 3 ? 'Zed early' : `Customer ${String(id).padStart(3, '0')}`

/** 30 keys, one a day back from NOW; 11 and 12 share a creation time. */
const KEYS = Array.from({ length: 30 }, (_, index) => {
  const id = index + 1
  const group = (n: number) => String(n).padStart(4, '0')
  return {
    id,
    key: `K${group(id).slice(1)}-AAAA-BBBB-CCCC-${id === 9 ? 'X1X0' : group(id)}`,
    template: TEMPLATES[id % 3]!,
    status: STATUSES[id % 3]!,
    customerId: id % 4 === 0 ? 515 : id % 4 === 1 ? 3 : null,
    productId: id % 5 === 0 ? 520 : null,
    orderId: id % 6 === 0 ? 510 : null,
    // Day offsets around the 30-day window: some inside, some past, some long gone.
    expiryDays: [-5, 1, 10, 29, 31, 90][id % 6]!,
    daysAgo: id === 12 ? 11 : id,
  }
})
type Key = typeof KEYS[number]

const ids = (keys: Key[]) => keys.map(key => String(key.id))
const newestFirst = (a: Key, b: Key) => a.daysAgo - b.daysAgo || b.id - a.id

function query(overrides: Partial<LicenseKeyListQuery> = {}): LicenseKeyListQuery {
  return { search: '', sort: 'created', direction: 'desc', page: 1, perPage: 10, ...overrides }
}

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  const rows = (count: number, columns: number) => Array.from({ length: count }, (_, i) => `(${Array.from({ length: columns }, (_, c) => p(i * columns + c + 1)).join(', ')})`).join(', ')
  const enumOf = (values: readonly string[]) => values.map(value => `'${value}'`).join(', ')
  let template = text
  let status = text
  if (dialect === 'postgres') {
    await run(`CREATE TYPE key_template AS ENUM (${enumOf(TEMPLATES)})`)
    await run(`CREATE TYPE key_status AS ENUM (${enumOf(STATUSES)})`)
    template = 'key_template'
    status = 'key_status'
  }
  if (dialect === 'mysql') {
    template = `ENUM(${enumOf(TEMPLATES)})`
    status = `ENUM(${enumOf(STATUSES)})`
  }
  await run(`CREATE TABLE customers (id ${pk}, name ${text}, email ${text})`)
  await run(`CREATE TABLE products (id ${pk}, name ${text})`)
  await run(`CREATE TABLE orders (id ${pk}, status ${text})`)
  await run(`CREATE TABLE license_keys (id ${pk}, ${dialect === 'mysql' ? '`key`' : 'key'} ${text}, template ${template}, expiry_date ${time}, status ${status}, customer_id INTEGER NULL, product_id INTEGER NULL, order_id INTEGER NULL, created_at ${time}, updated_at ${time} NULL, uuid ${text} NULL)`)
  const all = Array.from({ length: ROWS }, (_, i) => i + 1)
  await run(`INSERT INTO customers (id, name, email) VALUES ${rows(ROWS, 3)}`, all.flatMap(id => [id, customerName(id), `buyer${id}@shop.test`]))
  await run(`INSERT INTO products (id, name) VALUES ${rows(ROWS, 2)}`, all.flatMap(id => [id, id === 520 ? 'Zebra Suite' : `Product ${String(id).padStart(3, '0')}`]))
  await run(`INSERT INTO orders (id, status) VALUES ${rows(ROWS, 2)}`, all.flatMap(id => [id, id === 510 ? 'refunded' : 'completed']))
  const keyColumn = dialect === 'mysql' ? '`key`' : 'key'
  await run(
    `INSERT INTO license_keys (id, ${keyColumn}, template, expiry_date, status, customer_id, product_id, order_id, created_at) VALUES ${rows(KEYS.length, 9)}`,
    KEYS.flatMap(key => [key.id, key.key, key.template, stamp(NOW.getTime() + key.expiryDays * DAY), key.status, key.customerId, key.productId, key.orderId, stamp(NOW.getTime() - key.daysAgo * DAY)]),
  )
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const read = (overrides: Partial<LicenseKeyListQuery> = {}) => readLicenseKeyPage(query(overrides), runner, dialect, NOW)
  const all = async (overrides: Partial<LicenseKeyListQuery> = {}) => (await read({ perPage: 100, ...overrides })).records.map(record => String(record.id))
  const matching = (keep: (key: Key) => boolean) => ids(KEYS.filter(keep).sort(newestFirst))

  // The summary counts every key, whatever the page is searched for.
  const searched = await read({ search: 'zelda' })
  expect(searched.summary).toEqual({
    total: KEYS.length,
    active: KEYS.filter(key => key.status === 'active').length,
    assigned: KEYS.filter(key => key.customerId || key.productId || key.orderId).length,
    expiring: KEYS.filter(key => key.expiryDays >= 0 && key.expiryDays <= 30).length,
  })
  expect(searched.total).toBe(KEYS.filter(key => key.customerId === 515).length)

  // Search: the key with a digit pattern, the customer's name and email, the product, the order id, the enums.
  expect(await all({ search: 'x1x0' })).toEqual(['9'])
  expect(await all({ search: 'BUYER515@' })).toEqual(matching(key => key.customerId === 515))
  expect(await all({ search: 'zebra suite' })).toEqual(matching(key => key.productId === 520))
  expect(await all({ search: '510' })).toEqual(matching(key => key.orderId === 510))
  expect(await all({ search: 'ENTERPRISE' })).toEqual(matching(key => key.template === 'Enterprise License'))

  // Newest first, the id breaking the tie between 11 and 12, stable across pages.
  const newest = [...KEYS].sort(newestFirst)
  const pages = [await read({ page: 1 }), await read({ page: 2 }), await read({ page: 3 })]
  expect(pages.flatMap(result => result.records.map(record => String(record.id)))).toEqual(ids(newest))

  // Sorts by name, not enum order; ties newest first.
  const by = (value: (key: Key) => string) => (a: Key, b: Key) => value(a).localeCompare(value(b)) || newestFirst(a, b)
  expect(await all({ sort: 'template', direction: 'asc' })).toEqual(ids([...KEYS].sort(by(key => key.template))))
  expect(await all({ sort: 'status', direction: 'asc' })).toEqual(ids([...KEYS].sort(by(key => key.status))))
  expect(await all({ sort: 'customer', direction: 'asc' })).toEqual(ids([...KEYS].sort(by(key => key.customerId ? customerName(key.customerId).toLowerCase() : ''))))

  // The links past the 500th come with the key.
  const linked = (await read({ search: 'BUYER515@' })).records.find(record => record.product_id === 520 || record.order_id === 510) ?? (await read({ search: 'BUYER515@' })).records[0]!
  expect(linked.customer).toEqual({ id: 515, label: 'zelda Late', detail: 'buyer515@shop.test' })
  const withProduct = (await read({ search: 'zebra suite' })).records[0]!
  expect(withProduct.product).toEqual({ id: 520, label: 'Zebra Suite' })
  const withOrder = (await read({ search: '510' })).records[0]!
  expect(withOrder.order).toEqual({ id: 510, label: 'Order #510', detail: 'refunded' })

  // The dialog's choices: bounded, searched, past the 500th.
  const choose = (kind: 'customers' | 'products' | 'orders', search: string, limit = 25) => searchLicenseKeyChoices(kind, { search, limit }, runner, dialect)
  expect((await choose('customers', 'ZE')).choices.map(choice => choice.label)).toEqual(['Zed early', 'zelda Late'])
  expect(await choose('products', '520')).toEqual({ choices: [{ id: 520, label: 'Zebra Suite' }], total: 1 })
  expect((await choose('orders', 'refund')).choices).toEqual([{ id: 510, label: 'Order #510', detail: 'refunded' }])
  const newestOrders = await choose('orders', '', 3)
  expect(newestOrders.choices.map(choice => choice.id)).toEqual([520, 519, 518])
  expect(newestOrders.total).toBe(ROWS)
}

describe('readLicenseKeyPage on SQLite', () => {
  test('summary, search, sorts, pages, links and choices', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readLicenseKeyPage on ${dialect}: summary, search, sorts, pages, links and choices`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Licence key list tests require a local disposable database server')

    const name = `stacks_license_keys_${crypto.randomUUID().replaceAll('-', '')}`
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

describe('parseLicenseKeyListQuery', () => {
  const reader = (values: Record<string, unknown>) => (key: string) => values[key] ?? ''

  test('defaults to every key, newest first, 25 a page', () => {
    expect(parseLicenseKeyListQuery(reader({}))).toEqual({ search: '', sort: 'created', direction: 'desc', page: 1, perPage: 25 })
    expect(parseLicenseKeyListQuery(reader({ sort: 'expiry' }))).toHaveProperty('direction', 'asc')
  })

  test('refuses values the page does not offer', () => {
    expect(parseLicenseKeyListQuery(reader({ sort: 'uuid' }))).toHaveProperty('error')
    expect(parseLicenseKeyListQuery(reader({ direction: 'up' }))).toHaveProperty('error')
  })
})
