import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import { searchCustomerChoices } from './commerce-choices'
import type { PosCatalogQuery } from './commerce-pos-catalog'
import { parsePosCatalogQuery, parsePosIds, readPosCatalogPage, readPosProducts, readPosSettings, readPosTaxRate } from './commerce-pos-catalog'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The point of sale's catalogue, settings and customers against each
 * dialect's real engine (stacksjs/stacks#3218), over 520 products,
 * categories, manufacturers and customers: it used to read the first 500 of
 * each.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const ROWS = 520
const pad = (id: number) => String(id).padStart(3, '0')

/** Products 511 to 520 are in category 515 and by manufacturer 520; the rest share seven categories. */
const PRODUCTS = Array.from({ length: ROWS }, (_, index) => {
  const id = index + 1
  return {
    id,
    name: id === 9 ? 'Latte_100%' : id === 10 ? 'Latte 1000' : `${id % 2 === 0 ? 'item' : 'Item'} ${pad(id)}`,
    available: id % 4 !== 0,
    inventory: id % 5 === 0 ? 0 : id,
    category: id > 510 ? 515 : (id % 7) + 1,
    manufacturer: id > 510 ? 520 : (id % 3) + 1,
  }
})
type Product = typeof PRODUCTS[number]
const sellable = (product: Product) => product.available && product.inventory > 0
const byName = (a: Product, b: Product) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id - b.id

function query(overrides: Partial<PosCatalogQuery> = {}): PosCatalogQuery {
  return { search: '', category: '', availability: '', page: 1, perPage: 50, ...overrides }
}

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const bool = dialect === 'postgres' ? 'BOOLEAN' : dialect === 'mysql' ? 'TINYINT(1)' : 'INTEGER'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  const rows = (count: number, columns: number) => Array.from({ length: count }, (_, i) => `(${Array.from({ length: columns }, (_, c) => p(i * columns + c + 1)).join(', ')})`).join(', ')
  const flag = (value: boolean) => dialect === 'postgres' ? value : (value ? 1 : 0)
  let customerStatus = text
  let rateStatus = text
  if (dialect === 'postgres') {
    await run(`CREATE TYPE customer_status AS ENUM ('Active', 'Inactive')`)
    await run(`CREATE TYPE rate_status AS ENUM ('active', 'inactive')`)
    customerStatus = 'customer_status'
    rateStatus = 'rate_status'
  }
  if (dialect === 'mysql') {
    customerStatus = `ENUM('Active', 'Inactive')`
    rateStatus = `ENUM('active', 'inactive')`
  }
  await run(`CREATE TABLE categories (id ${pk}, name ${text})`)
  await run(`CREATE TABLE manufacturers (id ${pk}, manufacturer ${text})`)
  await run(`CREATE TABLE products (id ${pk}, name ${text}, slug ${text}, description ${text} NULL, price INTEGER, image_url ${text} NULL, is_available ${bool}, inventory_count INTEGER, preparation_time INTEGER, allergens ${text} NULL, nutritional_info ${text} NULL, category_id INTEGER NULL, manufacturer_id INTEGER NULL, created_at ${time})`)
  await run(`CREATE TABLE customers (id ${pk}, name ${text}, email ${text}, phone ${text} NULL, status ${customerStatus})`)
  await run(`CREATE TABLE tax_rates (id ${pk}, rate INTEGER, status ${rateStatus}, is_default ${bool})`)

  const all = Array.from({ length: ROWS }, (_, i) => i + 1)
  await run(`INSERT INTO categories (id, name) VALUES ${rows(ROWS, 2)}`, all.flatMap(id => [id, id === 3 ? 'bakery' : `Category ${pad(id)}`]))
  await run(`INSERT INTO manufacturers (id, manufacturer) VALUES ${rows(ROWS, 2)}`, all.flatMap(id => [id, `Maker ${pad(id)}`]))
  await run(
    `INSERT INTO products (id, name, slug, price, is_available, inventory_count, preparation_time, allergens, category_id, manufacturer_id, created_at) VALUES ${rows(ROWS, 11)}`,
    PRODUCTS.flatMap(product => [product.id, product.name, `item-${product.id}`, 100 + product.id, flag(product.available), product.inventory, 5, '[]', product.category, product.manufacturer, '2026-11-01 09:00:00']),
  )
  await run(`INSERT INTO customers (id, name, email, phone, status) VALUES ${rows(ROWS, 5)}`, all.flatMap(id => [id, id === 515 ? 'Quinn Late' : `Customer ${pad(id)}`, `buyer${id}@shop.test`, null, id % 2 === 1 ? 'Active' : 'Inactive']))
  // The default active rate wins over earlier active ones and an inactive
  // default, though it is the last of 520: the checkout used to choose among
  // the first 500 by id, and would have charged 7 where the screen showed 11.
  const rates = all.map(id => id === 1
    ? [1, 5, 'inactive', flag(true)]
    : id === 2 ? [2, 7, 'active', flag(false)]
      : id === 3 ? [3, 9, 'active', flag(false)]
        : id === ROWS ? [id, 11, 'active', flag(true)]
          : [id, 3, 'inactive', flag(false)])
  await run(`INSERT INTO tax_rates (id, rate, status, is_default) VALUES ${rows(ROWS, 4)}`, rates.flat())
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const page = (overrides: Partial<PosCatalogQuery> = {}) => readPosCatalogPage(query(overrides), runner, dialect)
  const idsOf = (result: { products: Array<{ id: string }> }) => result.products.map(product => product.id)
  const ids = (products: Product[]) => products.map(product => String(product.id))

  // Settings, counted over every product.
  const settings = await readPosSettings(runner, dialect)
  expect(settings.taxRate).toBe(11)
  expect(await readPosTaxRate(runner, dialect)).toBe(11)
  expect(settings.summary).toEqual({
    products: ROWS,
    sellable: PRODUCTS.filter(sellable).length,
    inventory: PRODUCTS.reduce((sum, product) => sum + product.inventory, 0),
  })
  expect(settings.categories.map(category => category.label)).toEqual(['bakery', 'Category 001', 'Category 002', 'Category 004', 'Category 005', 'Category 006', 'Category 007', 'Category 515'])

  // The catalogue by name ignoring case, paged, and every filter.
  const sorted = [...PRODUCTS].sort(byName)
  expect(idsOf(await page())).toEqual(ids(sorted.slice(0, 50)))
  expect(idsOf(await page({ page: 11 }))).toEqual(ids(sorted.slice(500)))
  expect((await page({ page: 99 })).page).toBe(11)
  expect((await page({ availability: 'sellable' })).total).toBe(PRODUCTS.filter(sellable).length)
  expect((await page({ availability: 'unsellable' })).total).toBe(PRODUCTS.filter(product => !sellable(product)).length)
  expect(idsOf(await page({ category: '515' }))).toEqual(ids(PRODUCTS.filter(product => product.category === 515).sort(byName)))
  expect(idsOf(await page({ search: '100%' }))).toEqual(['9'])
  expect((await page({ search: 'bakery' })).total).toBe(PRODUCTS.filter(product => product.category === 3).length)

  // Category and manufacturer past the 500th, read by the ids the page references.
  const last = (await page({ category: '515' })).products.find(product => product.id === '520')!
  expect(last).toMatchObject({ name: 'item 520', categoryId: '515', categoryName: 'Category 515' })

  // The cart's own products, whatever page the catalogue shows; a deleted one is absent.
  const cart = await readPosProducts([520, 3, 99_999], runner, dialect)
  expect(cart.map(product => product.id).sort()).toEqual(['3', '520'])
  // The checkout prices these, named by a category past the 500th.
  expect(cart.find(product => product.id === '520')).toMatchObject({ categoryName: 'Category 515' })

  // The checkout's customers: Active only, and found past the 500th.
  const active = await searchCustomerChoices({ search: '', limit: 5 }, runner, dialect, { activeOnly: true })
  expect(active.total).toBe(ROWS / 2)
  expect((await searchCustomerChoices({ search: 'quinn', limit: 5 }, runner, dialect, { activeOnly: true })).choices.map(choice => choice.id)).toEqual(['515'])
  expect((await searchCustomerChoices({ search: 'customer 002', limit: 5 }, runner, dialect, { activeOnly: true })).total).toBe(0)
  expect((await searchCustomerChoices({ search: 'customer 002', limit: 5 }, runner, dialect)).total).toBe(1)
}

describe('point of sale catalogue on SQLite', () => {
  test('settings, catalogue, cart products and customers', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`point of sale catalogue on ${dialect}: settings, catalogue, cart products and customers`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Point of sale tests require a local disposable database server')

    const name = `stacks_pos_catalog_${crypto.randomUUID().replaceAll('-', '')}`
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

describe('point of sale query parsing', () => {
  const reader = (values: Record<string, unknown>) => (key: string) => values[key] ?? ''

  test('the catalogue defaults to every product, 50 a page', () => {
    expect(parsePosCatalogQuery(reader({}))).toEqual({ search: '', category: '', availability: '', page: 1, perPage: 50 })
    expect(parsePosCatalogQuery(reader({ availability: 'available' }))).toHaveProperty('error')
    expect(parsePosCatalogQuery(reader({ category: 'drinks' }))).toHaveProperty('error')
  })

  test('cart ids are bounded product ids', () => {
    expect(parsePosIds(reader({}))).toEqual([])
    expect(parsePosIds(reader({ ids: '3, 520,3' }))).toEqual([3, 520])
    expect(parsePosIds(reader({ ids: '3,x' }))).toHaveProperty('error')
    expect(parsePosIds(reader({ ids: Array.from({ length: 101 }, (_, i) => i + 1).join(',') }))).toHaveProperty('error')
  })
})
