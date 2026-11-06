import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { OrderListQuery, OrderListRunner } from './commerce-order-list'
import { ordersCsv, parseOrderListQuery, readOrderPage, readOrdersForExport } from './commerce-order-list'

/**
 * The Orders list against each dialect's real engine (stacksjs/stacks#3218):
 * search, filters, sorts, paging, store-wide summary and the full export.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const CUSTOMERS: Array<[number, string, string]> = [
  [1, 'Ava Stone', 'ava@example.com'],
  [2, 'ben carter', 'BEN@example.com'],
  [3, 'Cara Lim', 'cara@example.com'],
]
const STATUSES = ['PENDING', 'preparing', 'DELIVERED', 'CANCELED', 'READY']
const TYPES = ['DELIVERY', 'TAKEOUT', 'DINE_IN']

/** 30 orders: customers 1-3 and unassigned in turn, five statuses, three types. */
const ORDERS = Array.from({ length: 30 }, (_, index) => {
  const id = index + 1
  return {
    id,
    customer_id: id % 4 === 0 ? null : (id % 3) + 1,
    status: STATUSES[id % STATUSES.length]!,
    total_amount: (id * 37) % 101 * 100,
    // Two spellings of one currency must be one total.
    currency: id % 7 === 0 ? 'eur' : (id % 2 === 0 ? 'EUR' : 'USD'),
    order_type: TYPES[id % TYPES.length]!,
    delivery_address: id === 13 ? '100% Sure Street' : `${id} Main Street`,
    coupon_id: id % 10 === 0 ? 2 : null,
    created_at: `2026-11-${String(1 + (id % 9)).padStart(2, '0')} 10:00:00`,
  }
})

function query(overrides: Partial<OrderListQuery> = {}): OrderListQuery {
  return { search: '', status: '', type: '', sort: 'created', direction: 'desc', page: 1, perPage: 10, ...overrides }
}

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME' : 'TIMESTAMP'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  await run(`CREATE TABLE customers (id ${pk}, name ${text}, email ${text})`)
  await run(`CREATE TABLE coupons (id ${pk})`)
  await run(`CREATE TABLE order_items (id ${pk}, order_id INTEGER, quantity INTEGER)`)
  await run(`CREATE TABLE orders (id ${pk}, uuid ${text}, customer_id INTEGER NULL, coupon_id INTEGER NULL, status ${text}, total_amount INTEGER, currency ${text}, tax_amount INTEGER, discount_amount INTEGER, delivery_fee INTEGER, tip_amount INTEGER, order_type ${text}, delivery_address ${text} NULL, special_instructions ${text} NULL, estimated_delivery_time ${text} NULL, applied_coupon_id ${text} NULL, created_at ${time})`)
  const p = (n: number) => dialect === 'postgres' ? `$${n}` : '?'
  const ps = (count: number) => Array.from({ length: count }, (_, i) => p(i + 1)).join(', ')
  for (const customer of CUSTOMERS)
    await run(`INSERT INTO customers (id, name, email) VALUES (${ps(3)})`, customer)
  await run(`INSERT INTO coupons (id) VALUES (${ps(1)})`, [2])
  for (const order of ORDERS) {
    await run(
      `INSERT INTO orders (id, customer_id, coupon_id, status, total_amount, currency, tax_amount, discount_amount, delivery_fee, tip_amount, order_type, delivery_address, created_at) VALUES (${ps(13)})`,
      [order.id, order.customer_id, order.coupon_id, order.status, order.total_amount, order.currency, 0, 0, 0, 0, order.order_type, order.delivery_address, order.created_at],
    )
  }
  // Order 5 has two lines, 3 + 2 items.
  await run(`INSERT INTO order_items (id, order_id, quantity) VALUES (${ps(3)})`, [1, 5, 3])
  await run(`INSERT INTO order_items (id, order_id, quantity) VALUES (${ps(3)})`, [2, 5, 2])
}

async function exercise(runner: OrderListRunner, dialect: Dialect) {
  const read = (overrides: Partial<OrderListQuery> = {}) => readOrderPage(query(overrides), runner, dialect)

  // The summary covers every order, not the page of 10.
  const first = await read()
  expect(first.total).toBe(30)
  expect(first.records).toHaveLength(10)
  expect(first.summary.total).toBe(30)
  const statusCount = (names: string[]) => ORDERS.filter(order => names.includes(order.status.toUpperCase())).length
  expect(first.summary.pending).toBe(statusCount(['PENDING', 'NEW']))
  expect(first.summary.inProgress).toBe(statusCount(['PREPARING', 'PROCESSING', 'READY', 'SHIPPED']))
  expect(first.summary.completed).toBe(statusCount(['DELIVERED', 'COMPLETED', 'PAID']))
  expect(first.summary.cancelled).toBe(statusCount(['CANCELED', 'CANCELLED', 'REFUNDED']))
  const sum = (currency: string) => ORDERS.filter(order => order.currency.toUpperCase() === currency).reduce((total, order) => total + order.total_amount, 0)
  expect(first.summary.currencyTotals).toEqual([{ currency: 'EUR', amount: sum('EUR') }, { currency: 'USD', amount: sum('USD') }])
  expect(first.statuses).toContain('preparing')

  // Newest first, ties broken by id descending: stable across page boundaries.
  const expected = [...ORDERS].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id).map(order => String(order.id))
  const pages = [await read({ page: 1 }), await read({ page: 2 }), await read({ page: 3 })]
  expect(pages.flatMap(result => result.records.map(record => record.id))).toEqual(expected)

  // Past the end moves back to the last page.
  expect((await read({ page: 9 })).page).toBe(3)

  // Search: customer name in any case, address, literal %, id.
  const ben = await read({ search: 'BEN', perPage: 100 })
  expect(ben.total).toBe(ORDERS.filter(order => order.customer_id === 2).length)
  expect(ben.records.every(record => record.customerName === 'ben carter')).toBeTrue()
  expect((await read({ search: '100%' })).records.map(record => record.id)).toEqual(['13'])
  expect((await read({ search: '27', perPage: 100 })).records.map(record => record.id)).toContain('27')

  // Filters are exact values.
  expect((await read({ status: 'preparing', perPage: 100 })).total).toBe(ORDERS.filter(order => order.status === 'preparing').length)
  expect((await read({ type: 'TAKEOUT', perPage: 100 })).total).toBe(ORDERS.filter(order => order.order_type === 'TAKEOUT').length)

  // Totals sort, high first.
  const byTotal = await read({ sort: 'total', direction: 'desc', perPage: 100 })
  const totals = byTotal.records.map(record => record.totalAmount)
  expect(totals).toEqual([...totals].sort((a, b) => b - a))

  // Customer sort: unassigned first ascending, then by name ignoring case.
  const byCustomer = (await read({ sort: 'customer', direction: 'asc', perPage: 100 })).records.map(record => record.customerName)
  const unassigned = ORDERS.filter(order => order.customer_id === null).length
  expect(byCustomer.slice(0, unassigned).every(name => name === '')).toBeTrue()
  expect(byCustomer.slice(unassigned)).toEqual([...byCustomer.slice(unassigned)].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())))

  // Item counts and coupon references come through.
  const five = (await read({ search: '5 Main', perPage: 100 })).records.find(record => record.id === '5')
  expect(five?.itemCount).toBe(5)
  expect((await read({ search: '10 Main' })).records[0]?.couponId).toBe('2')

  // The export reads every match, in order, across batches.
  const exported = await readOrdersForExport({ search: '', status: '', type: '', sort: 'created', direction: 'desc' }, runner, dialect, 4)
  expect(exported.map(record => record.id)).toEqual(expected)
  const filtered = await readOrdersForExport({ search: 'ben', status: '', type: '', sort: 'created', direction: 'desc' }, runner, dialect, 4)
  expect(filtered).toHaveLength(ben.total)
}

describe('readOrderPage on SQLite', () => {
  test('searches, filters, sorts, pages, summarises and exports', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readOrderPage on ${dialect} searches, filters, sorts, pages, summarises and exports`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Order list tests require a local disposable database server')

    const name = `stacks_order_list_${crypto.randomUUID().replaceAll('-', '')}`
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

describe('parseOrderListQuery', () => {
  const reader = (values: Record<string, unknown>) => (key: string) => values[key] ?? ''

  test('defaults to the newest 25', () => {
    expect(parseOrderListQuery(reader({}))).toEqual({ search: '', status: '', type: '', sort: 'created', direction: 'desc', page: 1, perPage: 25 })
  })

  test('rejects what it cannot honour', () => {
    expect(parseOrderListQuery(reader({ sort: 'secret_column' }))).toHaveProperty('error')
    expect(parseOrderListQuery(reader({ direction: 'sideways' }))).toHaveProperty('error')
    expect(parseOrderListQuery(reader({ per_page: '7' }))).toHaveProperty('error')
    expect(parseOrderListQuery(reader({ page: '0' }))).toHaveProperty('error')
  })
})

test('the CSV keeps the columns the page exported, with every row', () => {
  const record = { id: '7', customerId: '', customerName: 'Ava "A" Stone', customerEmail: 'ava@example.com', status: 'READY', totalAmount: 1250, currency: 'USD', taxAmount: 0, discountAmount: 0, deliveryFee: 0, tipAmount: 0, orderType: 'DELIVERY', deliveryAddress: '1 Main', specialInstructions: '', estimatedDeliveryTime: '', appliedCouponId: '', couponId: '', itemCount: 2, createdAt: '2026-11-01T10:00:00.000Z' }
  const csv = ordersCsv([record], (amount) => (amount / 100).toFixed(2))
  const [header, row] = csv.replace('﻿', '').split('\n')
  expect(header).toBe('"Order ID","Customer","Customer email","Status","Order type","Items","Total","Currency","Tax","Discount","Delivery fee","Tip","Delivery address","Created at"')
  expect(row).toBe('"7","Ava ""A"" Stone","ava@example.com","READY","DELIVERY","2","12.50","USD","0.00","0.00","0.00","0.00","1 Main","2026-11-01T10:00:00.000Z"')
})
