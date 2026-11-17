import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { CommerceSqlRunner } from './commerce-sql'
import type { DiscountListQuery } from './commerce-discount-list'
import type { UpsellListQuery } from './commerce-upsell-list'
import { parseDiscountListQuery, readDiscountPage } from './commerce-discount-list'
import { parseUpsellListQuery, readUpsellDetail, readUpsellPage } from './commerce-upsell-list'
import { discountWriteData } from './discount-records'
import { upsellWriteData } from './upsell-offer-records'

/**
 * The Discounts and Upsells dashboard pages' server side, against each
 * dialect's real engine: what a discount's state is right now, the funnel each
 * offer's responses add up to, and the writes the dialogs send.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'
type Run = (sql: string, values?: unknown[]) => Promise<unknown>

const NOW = new Date('2026-11-16T12:00:00Z')

function discountQuery(overrides: Partial<DiscountListQuery> = {}): DiscountListQuery {
  return { search: '', method: '', type: '', state: '', sort: 'newest', direction: 'desc', page: 1, perPage: 25, ...overrides }
}

function upsellQuery(overrides: Partial<UpsellListQuery> = {}): UpsellListQuery {
  return { search: '', state: '', sort: 'priority', direction: 'desc', page: 1, perPage: 25, ...overrides }
}

async function setUp(run: Run, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const bool = dialect === 'postgres' ? 'BOOLEAN' : dialect === 'mysql' ? 'TINYINT(1)' : 'INTEGER'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  const insert = async (table: string, row: Record<string, unknown>) => {
    const columns = Object.keys(row)
    await run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => p(i + 1)).join(', ')})`, Object.values(row))
  }
  const flag = (value: boolean) => dialect === 'postgres' ? value : (value ? 1 : 0)

  await run(`CREATE TABLE products (id ${pk}, name ${text})`)
  await run(`CREATE TABLE discounts (id ${pk}, title ${text}, code ${text} NULL, type ${text}, value INTEGER, scope ${text} NULL, per_item ${bool} NULL, target ${text} NULL, buy_quantity INTEGER NULL, buy_target ${text} NULL, get_quantity INTEGER NULL, get_target ${text} NULL, get_percent INTEGER NULL, max_applications INTEGER NULL, tiers ${text} NULL, max_shipping INTEGER NULL, minimum_subtotal INTEGER NULL, minimum_quantity INTEGER NULL, max_amount INTEGER NULL, combines_with_product ${bool} NULL, combines_with_order ${bool} NULL, combines_with_shipping ${bool} NULL, usage_limit INTEGER NULL, usage_count INTEGER NULL, is_active ${bool} NULL, starts_at ${text} NULL, ends_at ${text} NULL, created_at ${text})`)
  await run(`CREATE TABLE post_purchase_offers (id ${pk}, name ${text}, headline ${text} NULL, message ${text} NULL, product_ids ${text}, discount_percent INTEGER, min_quantity INTEGER, default_quantity INTEGER, max_quantity INTEGER NULL, trigger_product_ids ${text} NULL, min_order_total INTEGER NULL, window_minutes INTEGER, priority INTEGER, is_active ${bool} NULL, starts_at ${text} NULL, ends_at ${text} NULL, created_at ${text})`)
  await run(`CREATE TABLE post_purchase_offer_responses (id ${pk}, post_purchase_offer_id INTEGER, order_id INTEGER, status ${text}, product_id INTEGER, variant_id INTEGER NULL, quantity INTEGER NULL, unit_price INTEGER NULL, compare_at_price INTEGER NULL, amount INTEGER NULL, currency ${text} NULL, failure_reason ${text} NULL, responded_at ${text} NULL, created_at ${text})`)

  for (const [id, name] of [[1, 'Toe Socks'], [2, 'Crew Socks'], [3, 'Ankle Socks']] as const)
    await insert('products', { id, name })

  const created = '2026-11-01 09:00:00'
  // 1: automatic buy 4 get 4 free, running. 2: code, used up. 3: scheduled.
  // 4: expired. 5: switched off. 6: volume tiers, running, most used.
  await insert('discounts', { id: 1, title: 'BUY 4, GET 4 FREE | 50% OFF', code: null, type: 'buy_x_get_y', value: 0, buy_quantity: 4, get_quantity: 4, get_percent: 100, target: JSON.stringify({ productIds: [1] }), usage_count: 12, is_active: flag(true), created_at: created })
  await insert('discounts', { id: 2, title: 'Welcome', code: 'WELCOME10', type: 'percentage', value: 10, usage_limit: 3, usage_count: 3, is_active: flag(true), created_at: created })
  await insert('discounts', { id: 3, title: 'Black Friday', code: 'BF30', type: 'percentage', value: 30, usage_count: 0, is_active: flag(true), starts_at: '2026-11-27 00:00:00', created_at: created })
  await insert('discounts', { id: 4, title: 'Summer', code: 'SUMMER', type: 'fixed_amount', value: 500, usage_count: 7, is_active: flag(true), ends_at: '2026-08-31 23:59:59', created_at: created })
  await insert('discounts', { id: 5, title: 'Free shipping', code: null, type: 'free_shipping', value: 0, usage_count: 0, is_active: flag(false), created_at: created })
  await insert('discounts', { id: 6, title: 'Stock up', code: null, type: 'volume', value: 0, tiers: JSON.stringify([{ minQuantity: 10, percent: 30 }, { minQuantity: 5, percent: 20 }]), usage_count: 40, is_active: flag(true), created_at: created })

  await insert('post_purchase_offers', { id: 1, name: 'Sock bundle', headline: 'One-time offer', message: 'Grab 5+ pairs and get 60% off!', product_ids: JSON.stringify([2, 3, 99]), discount_percent: 60, min_quantity: 5, default_quantity: 5, trigger_product_ids: JSON.stringify([1]), window_minutes: 30, priority: 10, is_active: flag(true), created_at: created })
  await insert('post_purchase_offers', { id: 2, name: 'Holiday', product_ids: JSON.stringify([3]), discount_percent: 20, min_quantity: 1, default_quantity: 1, window_minutes: 15, priority: 1, is_active: flag(true), starts_at: '2026-12-01 00:00:00', created_at: created })
  await insert('post_purchase_offers', { id: 3, name: 'Retired', product_ids: JSON.stringify([2]), discount_percent: 10, min_quantity: 1, default_quantity: 1, window_minutes: 30, priority: 0, is_active: flag(false), created_at: created })

  const responses: Array<[number, number, string, number, number | null, number | null]> = [
    // offer, order, status, product, quantity, amount
    [1, 100, 'accepted', 2, 5, 4800],
    [1, 100, 'declined', 3, null, null],
    [1, 101, 'accepted', 3, 5, 4200],
    [1, 101, 'viewed', 2, null, null],
    [1, 102, 'failed', 2, 5, 4800],
    [3, 103, 'accepted', 2, 1, 2160],
  ]
  for (const [index, [offer, order, status, product, quantity, amount]] of responses.entries())
    await insert('post_purchase_offer_responses', { id: index + 1, post_purchase_offer_id: offer, order_id: order, status, product_id: product, quantity, amount, unit_price: amount && quantity ? amount / quantity : null, currency: 'USD', created_at: created })
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const discounts = (overrides: Partial<DiscountListQuery> = {}) => readDiscountPage(discountQuery(overrides), 'USD', runner, dialect, NOW)
  const ids = (page: { records: Array<{ id: string }> }) => page.records.map(record => record.id)

  const all = await discounts()
  expect(all.total).toBe(6)
  expect(ids(all)).toEqual(['6', '5', '4', '3', '2', '1'])
  expect(all.summary).toMatchObject({ total: 6, automatic: 3, code: 3, active: 2, scheduled: 1, expired: 1, exhausted: 1, disabled: 1, redemptions: 62 })
  expect(all.summary.byType).toEqual({ percentage: 2, fixed_amount: 1, buy_x_get_y: 1, volume: 1, free_shipping: 1 })
  expect(all.summary.mostUsed.map(entry => entry.title)).toEqual(['Stock up', 'BUY 4, GET 4 FREE | 50% OFF', 'Summer', 'Welcome'])

  const bxgy = all.records.find(record => record.id === '1')!
  expect(bxgy).toMatchObject({ method: 'automatic', type: 'buy_x_get_y', state: 'active', label: 'BUY 4, GET 4 FREE', appliesTo: 'product', buyQuantity: 4, getQuantity: 4, getPercent: 100 })
  expect(bxgy.target.productIds).toEqual(['1'])
  expect(bxgy.productLabels).toEqual({ 1: 'Toe Socks' })
  expect(all.records.find(record => record.id === '6')!.tiers).toEqual([{ minQuantity: 5, percent: 20 }, { minQuantity: 10, percent: 30 }])
  expect(all.records.find(record => record.id === '4')).toMatchObject({ state: 'expired', label: '$5.00 OFF', endsAt: '2026-08-31', appliesTo: 'order' })

  // Each state filter agrees with the state each record reports.
  for (const state of ['active', 'scheduled', 'expired', 'exhausted', 'disabled'] as const) {
    const page = await discounts({ state })
    expect(page.records.every(record => record.state === state)).toBe(true)
    expect(page.total).toBe(all.summary[state])
  }
  expect(ids(await discounts({ method: 'code', sort: 'title', direction: 'asc' }))).toEqual(['3', '4', '2'])
  expect(ids(await discounts({ type: 'free_shipping' }))).toEqual(['5'])
  expect(ids(await discounts({ search: 'welcome' }))).toEqual(['2'])
  expect(ids(await discounts({ sort: 'usage' }))).toEqual(['6', '1', '4', '2', '3', '5'])
  // Undated last either way.
  expect(ids(await discounts({ sort: 'ends', direction: 'asc' }))[0]).toBe('4')

  const offers = (overrides: Partial<UpsellListQuery> = {}) => readUpsellPage(upsellQuery(overrides), runner, dialect, NOW)
  const page = await offers()
  expect(ids(page)).toEqual(['1', '2', '3'])
  const bundle = page.records[0]!
  expect(bundle).toMatchObject({ name: 'Sock bundle', state: 'running', discountPercent: 60, minQuantity: 5 })
  expect(bundle.products.map(p => [p.id, p.label, p.exists])).toEqual([['2', 'Crew Socks', true], ['3', 'Ankle Socks', true], ['99', 'Deleted product #99', false]])
  expect(bundle.triggerProducts.map(p => p.label)).toEqual(['Toe Socks'])
  expect(bundle.stats).toEqual({ views: 5, accepted: 2, declined: 1, pending: 0, failed: 1, conversionRate: 0.4, revenue: 9000, units: 10 })
  expect(page.records[1]!.state).toBe('scheduled')
  expect(page.records[2]!).toMatchObject({ state: 'disabled', stats: { accepted: 1, revenue: 2160 } })

  expect(page.summary).toMatchObject({ total: 3, running: 1, views: 6, accepted: 3, declined: 1, revenue: 11160, units: 11 })
  expect(page.summary.conversionRate).toBe(0.5)
  expect(page.summary.top.map(entry => entry.name)).toEqual(['Sock bundle', 'Retired'])

  expect(ids(await offers({ state: 'running' }))).toEqual(['1'])
  expect(ids(await offers({ state: 'disabled' }))).toEqual(['3'])
  expect(ids(await offers({ sort: 'revenue' }))).toEqual(['1', '3', '2'])
  expect(ids(await offers({ search: '60%' }))).toEqual(['1'])

  const detail = await readUpsellDetail(1, 25, runner, dialect, NOW)
  expect(detail!.responses.map(r => [r.orderId, r.status, r.productLabel])).toEqual([
    ['102', 'failed', 'Crew Socks'],
    ['101', 'viewed', 'Crew Socks'],
    ['101', 'accepted', 'Ankle Socks'],
    ['100', 'declined', 'Ankle Socks'],
    ['100', 'accepted', 'Crew Socks'],
  ])
  expect(await readUpsellDetail(404, 25, runner, dialect, NOW)).toBeNull()
}

describe('list queries', () => {
  test('defaults and refusals', () => {
    const discounts = (values: Record<string, string>) => parseDiscountListQuery(key => values[key] ?? '')
    expect(discounts({})).toEqual(discountQuery())
    expect(discounts({ sort: 'title' })).toMatchObject({ direction: 'asc' })
    expect(discounts({ state: 'paused' })).toHaveProperty('error')
    expect(discounts({ method: 'magic' })).toHaveProperty('error')
    expect(discounts({ type: 'bogo' })).toHaveProperty('error')

    const upsells = (values: Record<string, string>) => parseUpsellListQuery(key => values[key] ?? '')
    expect(upsells({})).toEqual(upsellQuery())
    expect(upsells({ sort: 'name' })).toMatchObject({ direction: 'asc' })
    expect(upsells({ state: 'live' })).toHaveProperty('error')
  })
})

describe('discount writes', () => {
  test('a buy X get Y discount becomes the columns the engine reads', () => {
    const result = discountWriteData({ title: 'BUY 4, GET 4 FREE', method: 'automatic', type: 'buy_x_get_y', buyQuantity: 4, getQuantity: '4', getPercent: 100, target: { productIds: ['7'] }, startsAt: '2026-11-20', endsAt: '2026-11-30', combinesWith: { shipping: true } })
    expect(result).toMatchObject({ ok: true, data: { code: null, type: 'buy_x_get_y', buy_quantity: 4, get_quantity: 4, get_percent: 100, target: '{"productIds":[7],"variantIds":[],"categoryIds":[]}', starts_at: '2026-11-20 00:00:00', ends_at: '2026-11-30 23:59:59', combines_with_shipping: true, is_active: true } })
  })

  test('refuses by field what the engine would refuse at checkout', () => {
    expect(discountWriteData({ title: '', type: 'percentage', value: 10 })).toEqual({ ok: false, errors: { title: 'is required' } })
    expect(discountWriteData({ title: 'x', type: 'percentage', value: 120 })).toEqual({ ok: false, errors: { value: 'must be a whole number from 1 to 100' } })
    expect(discountWriteData({ title: 'x', method: 'code', type: 'percentage', value: 10 })).toEqual({ ok: false, errors: { code: 'is required for a discount code' } })
    expect(discountWriteData({ title: 'x', method: 'code', code: 'two words', type: 'percentage', value: 10 })).toMatchObject({ ok: false, errors: { code: expect.any(String) } })
    expect(discountWriteData({ title: 'x', type: 'volume', tiers: [] })).toEqual({ ok: false, errors: { tiers: 'add at least one tier' } })
    expect(discountWriteData({ title: 'x', type: 'volume', tiers: [{ minQuantity: 5, percent: 10 }, { minQuantity: 5, percent: 20 }] })).toMatchObject({ ok: false, errors: { tiers: expect.any(String) } })
    expect(discountWriteData({ title: 'x', type: 'buy_x_get_y' })).toMatchObject({ ok: false, errors: { buyQuantity: 'is required', getQuantity: 'is required', getPercent: 'is required' } })
    expect(discountWriteData({ title: 'x', type: 'percentage', value: 10, scope: 'product' })).toMatchObject({ ok: false, errors: { target: expect.any(String) } })
    expect(discountWriteData({ title: 'x', type: 'percentage', value: 10, startsAt: '2026-12-01', endsAt: '2026-11-01' })).toMatchObject({ ok: false, errors: { endsAt: expect.any(String) } })
  })

  test('upper-cases a code and keeps it', () => {
    expect(discountWriteData({ title: 'Welcome', method: 'code', code: 'welcome10', type: 'fixed_amount', value: 500, perItem: true })).toMatchObject({ ok: true, data: { code: 'WELCOME10', value: 500, per_item: true } })
  })
})

describe('upsell writes', () => {
  test('an offer becomes its columns, with the products to check', () => {
    const result = upsellWriteData({ name: 'Sock bundle', message: 'Grab 5+ pairs', productIds: ['2', '3', '2'], triggerProductIds: [1], discountPercent: '60', minQuantity: 5, defaultQuantity: 5, windowMinutes: 30, priority: 10 })
    expect(result).toMatchObject({ ok: true, productIds: [2, 3, 1], data: { product_ids: '[2,3]', trigger_product_ids: '[1]', discount_percent: 60, min_quantity: 5, default_quantity: 5, max_quantity: null, window_minutes: 30, priority: 10, is_active: true } })
  })

  test('refuses quantities that contradict each other and offers with nothing in them', () => {
    expect(upsellWriteData({ name: 'x', productIds: [] })).toMatchObject({ ok: false, errors: { productIds: expect.any(String) } })
    expect(upsellWriteData({ name: 'x', productIds: [1], minQuantity: 5, defaultQuantity: 2 })).toMatchObject({ ok: false, errors: { defaultQuantity: 'must be at least the minimum quantity' } })
    expect(upsellWriteData({ name: 'x', productIds: [1], minQuantity: 5, maxQuantity: 3 })).toMatchObject({ ok: false, errors: { maxQuantity: 'must be at least the minimum quantity' } })
    expect(upsellWriteData({ name: 'x', productIds: [1], discountPercent: 101 })).toMatchObject({ ok: false, errors: { discountPercent: expect.any(String) } })
    expect(upsellWriteData({ name: 'x', productIds: [1], windowMinutes: 0 })).toMatchObject({ ok: false, errors: { windowMinutes: expect.any(String) } })
  })
})

describe('Discounts and Upsells on SQLite', () => {
  test('states, filters, sorts, summaries, funnels and detail', async () => {
    const database = new Database(':memory:')
    const run: Run = async (sql, values = []) => database.query(sql).run(...(values as never[]))
    await setUp(run, 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`Discounts and Upsells on ${dialect}`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('These tests require a local disposable database server')

    const name = `stacks_discounts_${crypto.randomUUID().replaceAll('-', '')}`
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    const admin = new SQL({ url: url.href, database: decodeURIComponent(url.pathname.slice(1)) || undefined })
    await admin.unsafe(`CREATE DATABASE ${quoted}`)
    const scoped = new URL(url.href)
    scoped.pathname = `/${name}`
    const database = new SQL({ url: scoped.href, database: name })

    try {
      const run: Run = async (sql, values = []) => await database.unsafe(sql, values)
      await setUp(run, dialect)
      await exercise({ unsafe: (sql, values = []) => ({ execute: async () => await database.unsafe(sql, values) }) }, dialect)
    }
    finally {
      await database.close()
      try { await admin.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
      finally { await admin.close() }
    }
  }, 60_000)
}
