import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { CouponListQuery } from './commerce-coupon-list'
import { couponsCsv, parseCouponListQuery, readCouponPage, readCouponsForExport } from './commerce-coupon-list'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The coupons against each dialect's real engine (stacksjs/stacks#3218), over
 * 520 coupons and 600 products: the page used to read the newest 500 coupons
 * and check them against the first 500 products.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'
type Run = (sql: string, values?: unknown[]) => Promise<unknown>

const ROWS = 520
const PRODUCTS = 600
const pad = (value: number, size = 3) => String(value).padStart(size, '0')

/** Codes run opposite to ids, every third in lower case; every tenth is for a product past the 500th. */
const COUPONS = Array.from({ length: ROWS }, (_, index) => {
  const id = index + 1
  const percentage = id % 2 === 1
  return {
    id,
    code: id === 9 ? 'HALF_OFF' : `${id % 3 === 0 ? 'save' : 'SAVE'}${pad(ROWS + 1 - id)}`,
    description: id === 11 ? 'Take 100% off' : id % 5 === 0 ? null : `Promo ${id}`,
    status: (['Active', 'Scheduled', 'Expired'] as const)[id % 3]!,
    active: id % 4 !== 0,
    type: percentage ? 'percentage' : 'fixed_amount',
    value: percentage ? (id % 90) + 1 : 100 + id,
    limit: id % 6 === 0 ? null : 1000,
    usage: (id * 13) % 50,
    start: id % 7 === 0 ? null : `2026-01-${pad((id % 28) + 1, 2)}`,
    end: id % 5 === 0 ? null : `2026-${pad((id % 12) + 1, 2)}-${pad((id % 28) + 1, 2)}`,
    product: id % 10 === 0 ? 500 + (id % 100) + 1 : null,
    freeProduct: id % 8 === 0 ? `FREE-${id}` : null,
  }
})
type Coupon = typeof COUPONS[number]

function query(overrides: Partial<CouponListQuery> = {}): CouponListQuery {
  return { search: '', status: '', enabled: '', type: '', sort: 'newest', direction: 'desc', page: 1, perPage: 25, ...overrides }
}

/** The order the database is asked for, in plain code. */
function ordered(rows: Coupon[], sort: CouponListQuery['sort'], direction: 'asc' | 'desc'): Coupon[] {
  const sign = direction === 'asc' ? 1 : -1
  const compare = (left: string | number, right: string | number) => left < right ? -1 : left > right ? 1 : 0
  const key = (coupon: Coupon): string | number => {
    switch (sort) {
      case 'code': return coupon.code.toLowerCase()
      case 'usage': return coupon.usage
      case 'expiry': return coupon.end ?? ''
      case 'start': return coupon.start ?? ''
      case 'status': return coupon.status
      case 'availability': return coupon.active ? 1 : 0
      default: return coupon.id
    }
  }
  const dated = (coupon: Coupon) => sort === 'expiry' ? coupon.end : sort === 'start' ? coupon.start : 'any'
  return [...rows].sort((left, right) =>
    (Number(!dated(left)) - Number(!dated(right)))
    || sign * compare(key(left), key(right))
    || (sort === 'code' || sort === 'newest' ? 0 : compare(left.code.toLowerCase(), right.code.toLowerCase()))
    || sign * (left.id - right.id))
}

const ids = (rows: Coupon[]) => rows.map(coupon => String(coupon.id))

async function setUp(run: Run, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const bool = dialect === 'postgres' ? 'BOOLEAN' : dialect === 'mysql' ? 'TINYINT(1)' : 'INTEGER'
  const date = dialect === 'sqlite' ? 'TEXT' : 'DATE'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  const rows = (count: number, columns: number) => Array.from({ length: count }, (_, i) => `(${Array.from({ length: columns }, (_, c) => p(i * columns + c + 1)).join(', ')})`).join(', ')
  const flag = (value: boolean) => dialect === 'postgres' ? value : (value ? 1 : 0)
  await run(`CREATE TABLE products (id ${pk}, name ${text})`)
  await run(`CREATE TABLE coupons (id ${pk}, code ${text}, description ${text} NULL, status ${text}, is_active ${bool}, discount_type ${text}, discount_value INTEGER, min_order_amount INTEGER NULL, max_discount_amount INTEGER NULL, free_product_id ${text} NULL, product_id INTEGER NULL, usage_limit INTEGER NULL, usage_count INTEGER, start_date ${date} NULL, end_date ${date} NULL, created_at ${time})`)
  await run(`INSERT INTO products (id, name) VALUES ${rows(PRODUCTS, 2)}`, Array.from({ length: PRODUCTS }, (_, i) => [i + 1, `Product ${i + 1}`]).flat())
  await run(
    `INSERT INTO coupons (id, code, description, status, is_active, discount_type, discount_value, free_product_id, product_id, usage_limit, usage_count, start_date, end_date, created_at) VALUES ${rows(ROWS, 14)}`,
    COUPONS.flatMap(coupon => [
      coupon.id, coupon.code, coupon.description, coupon.status, flag(coupon.active), coupon.type, coupon.value,
      coupon.freeProduct, coupon.product, coupon.limit, coupon.usage, coupon.start, coupon.end, '2026-11-01 09:00:00',
    ]),
  )
}

async function exercise(runner: CommerceSqlRunner, run: Run, dialect: Dialect) {
  const page = (overrides: Partial<CouponListQuery> = {}) => readCouponPage(query(overrides), runner, dialect)
  const idsOf = (result: { records: Array<{ id: string }> }) => result.records.map(record => record.id)

  // Newest first, every one of them; coupons for products past the 500th read.
  const first = await page()
  expect(first.total).toBe(ROWS)
  expect(idsOf(first)).toEqual(ids(ordered(COUPONS, 'newest', 'desc').slice(0, 25)))
  expect(idsOf(await page({ page: 21 }))).toEqual(ids(ordered(COUPONS, 'newest', 'desc').slice(500)))
  expect(first.records.find(record => record.id === '520')).toMatchObject({ productId: '521', endDate: '', startDate: '2026-01-17' })

  // The cards and breakdowns are over every coupon.
  const countWhere = (test: (coupon: Coupon) => boolean) => COUPONS.filter(test).length
  expect(first.summary).toEqual({
    total: ROWS,
    enabled: countWhere(coupon => coupon.active),
    active: countWhere(coupon => coupon.status === 'Active'),
    scheduled: countWhere(coupon => coupon.status === 'Scheduled'),
    expired: countWhere(coupon => coupon.status === 'Expired'),
    percentage: countWhere(coupon => coupon.type === 'percentage'),
    fixedAmount: countWhere(coupon => coupon.type === 'fixed_amount'),
    redemptions: COUPONS.reduce((sum, coupon) => sum + coupon.usage, 0),
    mostUsed: [...COUPONS]
      .sort((left, right) => right.usage - left.usage || (left.code.toLowerCase() < right.code.toLowerCase() ? -1 : 1) || left.id - right.id)
      .slice(0, 5)
      .map(coupon => ({ id: String(coupon.id), code: coupon.code, usageCount: coupon.usage })),
  })

  // Every filter, together, and the search with % and _ taken literally.
  const matching = COUPONS.filter(coupon => coupon.status === 'Scheduled' && coupon.active && coupon.type === 'fixed_amount')
  expect(idsOf(await page({ status: 'Scheduled', enabled: 'enabled', type: 'fixed_amount', perPage: 100 }))).toEqual(ids(ordered(matching, 'newest', 'desc')))
  expect((await page({ enabled: 'disabled' })).total).toBe(countWhere(coupon => !coupon.active))
  expect(idsOf(await page({ search: '100%' }))).toEqual(['11'])
  expect(idsOf(await page({ search: 'f_o' }))).toEqual(['9'])
  expect(idsOf(await page({ search: 'free-16' }))).toEqual(['168', '160', '16'])

  // Every sort, both ways; coupons without the date last either way.
  for (const sort of ['code', 'usage', 'expiry', 'start', 'status', 'availability'] as const) {
    for (const direction of ['asc', 'desc'] as const)
      expect(idsOf(await page({ sort, direction, perPage: 100, page: 6 }))).toEqual(ids(ordered(COUPONS, sort, direction).slice(500)))
  }
  expect((await page({ sort: 'expiry', direction: 'desc', perPage: 10 })).records.every(record => record.endDate !== '')).toBe(true)

  // The export: every matching coupon in the page's order, a batch at a time,
  // a fixed amount in the store currency.
  const fixed = COUPONS.filter(coupon => coupon.type === 'fixed_amount')
  const exported = await readCouponsForExport({ search: '', status: '', enabled: '', type: 'fixed_amount', sort: 'usage', direction: 'desc' }, runner, dialect, 50)
  expect(exported.map(record => record.id)).toEqual(ids(ordered(fixed, 'usage', 'desc')))
  const top = ordered(fixed, 'usage', 'desc')[0]!
  const csv = couponsCsv(exported.slice(0, 1), 'JPY', (amount, currency) => `${amount} ${currency}`)
  expect(csv.charCodeAt(0)).toBe(0xFEFF)
  expect(csv.slice(1).split('\n')[1]).toBe(
    `"${top.code}","${top.description ?? ''}","${top.status}","${top.active ? 'Enabled' : 'Disabled'}","fixed_amount","${top.value} JPY","${top.usage}","${top.limit ?? ''}","${top.start ?? ''}","${top.end ?? ''}"`,
  )

  // A coupon for a product that does not exist still fails the page.
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  await run(`INSERT INTO coupons (id, code, status, is_active, discount_type, discount_value, product_id, usage_count, created_at) VALUES (${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(p).join(', ')})`, [600, 'GONE', 'Active', dialect === 'postgres' ? true : 1, 'percentage', 5, 9999, 0, '2026-11-01 09:00:00'])
  await expect(page()).rejects.toThrow('Coupon 600.product_id references missing Product 9999.')
}

describe('parseCouponListQuery', () => {
  test('defaults and refusals', () => {
    const read = (values: Record<string, string>) => parseCouponListQuery(key => values[key] ?? '')
    expect(read({})).toEqual(query())
    expect(read({ sort: 'code' })).toMatchObject({ sort: 'code', direction: 'asc' })
    expect(read({ sort: 'usage' })).toMatchObject({ direction: 'desc' })
    expect(read({ status: 'Paused' })).toEqual({ error: 'status must be one of Active, Scheduled, Expired.' })
    expect(read({ type: 'free' })).toHaveProperty('error')
    expect(read({ enabled: 'yes' })).toHaveProperty('error')
    expect(read({ sort: 'discount' })).toHaveProperty('error')
  })
})

describe('readCouponPage on SQLite', () => {
  test('filters, search, sorts, pages, summary and export', async () => {
    const database = new Database(':memory:')
    const run: Run = async (sql, values = []) => database.query(sql).run(...(values as never[]))
    await setUp(run, 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, run, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readCouponPage on ${dialect}: filters, search, sorts, pages, summary and export`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Coupon list tests require a local disposable database server')

    const name = `stacks_coupons_${crypto.randomUUID().replaceAll('-', '')}`
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    const admin = new SQL({ url: url.href, database: decodeURIComponent(url.pathname.slice(1)) || undefined })
    await admin.unsafe(`CREATE DATABASE ${quoted}`)
    const scoped = new URL(url.href)
    scoped.pathname = `/${name}`
    // Explicit database wins over inherited PGDATABASE / MYSQL_DATABASE in CI.
    const database = new SQL({ url: scoped.href, database: name })

    try {
      const run: Run = async (sql, values = []) => await database.unsafe(sql, values)
      await setUp(run, dialect)
      await exercise({ unsafe: (sql, values = []) => ({ execute: async () => await database.unsafe(sql, values) }) }, run, dialect)
    }
    finally {
      await database.close()
      try { await admin.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
      finally { await admin.close() }
    }
  }, 60_000)
}
