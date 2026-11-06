import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { CommerceSqlRunner } from './commerce-sql'
import type { ProductListQuery } from './commerce-product-list'
import { parseProductListQuery, productsCsv, readProductPage, readProductsForExport } from './commerce-product-list'

/**
 * The Products list against each dialect's real engine (stacksjs/stacks#3218),
 * with is_available as each dialect's own boolean.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const CATEGORIES: Array<[number, string]> = [[1, 'Pastry'], [2, 'drinks'], [3, 'Mains']]
const MANUFACTURERS: Array<[number, string]> = [[1, 'Acme Mills'], [2, 'Bean Co']]

/** 28 products across three categories, some unavailable, some out of stock. */
const PRODUCTS = Array.from({ length: 28 }, (_, index) => {
  const id = index + 1
  return {
    id,
    name: id === 9 ? 'Flat White 100%' : `Product ${String.fromCharCode(65 + (id % 26))}${id}`,
    slug: `product-${id}`,
    price: (id * 37) % 23 * 100,
    is_available: id % 4 !== 0,
    inventory_count: id % 5 === 0 ? 0 : id * 3,
    category_id: (id % 3) + 1,
    manufacturer_id: id % 2 === 0 ? 2 : (id % 7 === 0 ? null : 1),
    allergens: id === 11 ? '["peanuts","milk"]' : '[]',
    created_at: `2026-10-${String(1 + (id % 10)).padStart(2, '0')} 09:00:00`,
  }
})

function query(overrides: Partial<ProductListQuery> = {}): ProductListQuery {
  return { search: '', category: '', availability: '', sort: 'created', direction: 'desc', page: 1, perPage: 10, ...overrides }
}

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const bool = dialect === 'postgres' ? 'BOOLEAN' : dialect === 'mysql' ? 'TINYINT(1)' : 'INTEGER'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME' : 'TIMESTAMP'
  await run(`CREATE TABLE categories (id ${pk}, name ${text})`)
  await run(`CREATE TABLE manufacturers (id ${pk}, manufacturer ${text})`)
  for (const table of ['product_variants', 'product_units', 'reviews'])
    await run(`CREATE TABLE ${table} (id ${pk}, product_id INTEGER)`)
  await run(`CREATE TABLE products (id ${pk}, name ${text}, slug ${text}, description ${text} NULL, price INTEGER, image_url ${text} NULL, is_available ${bool}, inventory_count INTEGER, preparation_time INTEGER, allergens ${text} NULL, nutritional_info ${text} NULL, category_id INTEGER NULL, manufacturer_id INTEGER NULL, created_at ${time})`)
  const p = (count: number) => Array.from({ length: count }, (_, i) => dialect === 'postgres' ? `$${i + 1}` : '?').join(', ')
  for (const [id, name] of CATEGORIES)
    await run(`INSERT INTO categories (id, name) VALUES (${p(2)})`, [id, name])
  for (const [id, name] of MANUFACTURERS)
    await run(`INSERT INTO manufacturers (id, manufacturer) VALUES (${p(2)})`, [id, name])
  for (const product of PRODUCTS) {
    await run(
      `INSERT INTO products (id, name, slug, price, is_available, inventory_count, preparation_time, allergens, category_id, manufacturer_id, created_at) VALUES (${p(11)})`,
      [product.id, product.name, product.slug, product.price, dialect === 'postgres' ? product.is_available : (product.is_available ? 1 : 0), product.inventory_count, 5, product.allergens, product.category_id, product.manufacturer_id, product.created_at],
    )
  }
  // Product 4 has two variants, one unit and three reviews.
  let next = 1
  for (const [table, count] of [['product_variants', 2], ['product_units', 1], ['reviews', 3]] as const) {
    for (let i = 0; i < count; i++)
      await run(`INSERT INTO ${table} (id, product_id) VALUES (${p(2)})`, [next++, 4])
  }
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const read = (overrides: Partial<ProductListQuery> = {}) => readProductPage(query(overrides), runner, dialect)

  // The summary covers the catalogue, not the page.
  const first = await read()
  expect(first.total).toBe(28)
  expect(first.records).toHaveLength(10)
  expect(first.summary).toEqual({
    total: 28,
    available: PRODUCTS.filter(product => product.is_available).length,
    unavailable: PRODUCTS.filter(product => !product.is_available).length,
    outOfStock: PRODUCTS.filter(product => product.inventory_count === 0).length,
    totalInventory: PRODUCTS.reduce((sum, product) => sum + product.inventory_count, 0),
  })
  // Case is ignored, the same on every dialect.
  expect(first.categories.map(option => option.label)).toEqual(['drinks', 'Mains', 'Pastry'])

  // Filters.
  expect((await read({ category: '2', perPage: 100 })).total).toBe(PRODUCTS.filter(product => product.category_id === 2).length)
  expect((await read({ availability: 'available', perPage: 100 })).total).toBe(PRODUCTS.filter(product => product.is_available).length)
  expect((await read({ availability: 'unavailable', perPage: 100 })).total).toBe(PRODUCTS.filter(product => !product.is_available).length)
  expect((await read({ availability: 'out-of-stock', perPage: 100 })).total).toBe(PRODUCTS.filter(product => product.inventory_count === 0).length)

  // Search: the joined category and manufacturer, allergens, a literal %.
  expect((await read({ search: 'DRINKS', perPage: 100 })).total).toBe(PRODUCTS.filter(product => product.category_id === 2).length)
  expect((await read({ search: 'bean co', perPage: 100 })).total).toBe(PRODUCTS.filter(product => product.manufacturer_id === 2).length)
  expect((await read({ search: 'peanut' })).records.map(record => record.id)).toEqual(['11'])
  expect((await read({ search: '100%' })).records.map(record => record.id)).toEqual(['9'])

  // Newest first with id breaking ties, stable across pages.
  const newest = [...PRODUCTS].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id).map(product => String(product.id))
  const pages = [await read({ page: 1 }), await read({ page: 2 }), await read({ page: 3 })]
  expect(pages.flatMap(result => result.records.map(record => record.id))).toEqual(newest)
  expect((await read({ page: 7 })).page).toBe(3)

  // Price high first, ties by name.
  const byPrice = (await read({ sort: 'price', direction: 'desc', perPage: 100 })).records
  const expectedPrice = [...PRODUCTS].sort((a, b) => b.price - a.price || a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || b.id - a.id).map(product => String(product.id))
  expect(byPrice.map(record => record.id)).toEqual(expectedPrice)

  // Names sort ignoring case.
  const names = (await read({ sort: 'name', direction: 'asc', perPage: 100 })).records.map(record => record.name)
  expect(names).toEqual([...names].sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0))

  // Relations and references come through.
  const four = (await read({ search: 'product e4' })).records.find(record => record.id === '4')
  expect(four).toEqual(expect.objectContaining({ variantCount: 2, unitCount: 1, reviewCount: 3, categoryName: 'drinks', manufacturerName: 'Bean Co' }))

  // The export holds every match, across batches, in order.
  const exported = await readProductsForExport({ search: '', category: '', availability: '', sort: 'created', direction: 'desc' }, runner, dialect, 4)
  expect(exported.map(record => record.id)).toEqual(newest)
}

describe('readProductPage on SQLite', () => {
  test('summary, filters, search, sorts, pages and export', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readProductPage on ${dialect}: summary, filters, search, sorts, pages and export`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Product list tests require a local disposable database server')

    const name = `stacks_product_list_${crypto.randomUUID().replaceAll('-', '')}`
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

describe('parseProductListQuery', () => {
  const reader = (values: Record<string, unknown>) => (key: string) => values[key] ?? ''

  test('defaults to the newest 25', () => {
    expect(parseProductListQuery(reader({}))).toEqual({ search: '', category: '', availability: '', sort: 'created', direction: 'desc', page: 1, perPage: 25 })
  })

  test('rejects what it cannot honour', () => {
    expect(parseProductListQuery(reader({ category: '1 OR 1=1' }))).toHaveProperty('error')
    expect(parseProductListQuery(reader({ availability: 'maybe' }))).toHaveProperty('error')
    expect(parseProductListQuery(reader({ sort: 'cost' }))).toHaveProperty('error')
  })
})

test('the CSV keeps the columns the page exported', () => {
  const [header] = productsCsv([], 'USD', amount => String(amount)).replace('﻿', '').split('\n')
  expect(header).toBe('"Product ID","Name","Description","Price","Currency","Availability","Inventory","Preparation minutes","Category","Manufacturer","Allergens","Variants","Units","Reviews","Created at"')
})
