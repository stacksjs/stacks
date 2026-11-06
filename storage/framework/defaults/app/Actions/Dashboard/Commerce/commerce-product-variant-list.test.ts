import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { ProductVariantListQuery } from './commerce-product-variant-list'
import { parseProductVariantListQuery, readProductVariantPage } from './commerce-product-variant-list'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The Variants list against each dialect's real engine (stacksjs/stacks#3218),
 * with status as a real enum, options as a JSON array or a delimited list,
 * and products past the 500 the page used to read.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const PRODUCTS = 520
const STATUSES = ['active', 'inactive', 'draft'] as const
const TYPES = ['size', 'Color', 'material'] as const
const productName = (id: number) => id === 515 ? 'zebra Tea' : id === 2 ? 'Apron' : `Product ${String(id).padStart(3, '0')}`

/** How variant n stores its options: a JSON array, a comma, bar or newline list, or nothing. */
function optionsOf(id: number): { stored: string | null, count: number } {
  const values = Array.from({ length: id % 5 }, (_, i) => `opt${i + 1}`)
  if (values.length === 0)
    return { stored: id % 2 === 0 ? null : '', count: 0 }
  const stored = [JSON.stringify(values), values.join(', '), values.join('|'), values.join('\n')][id % 4]!
  return { stored, count: values.length }
}

/** 30 variants, a third each status; a quarter belong to product 515 and a quarter to product 2. */
const VARIANTS = Array.from({ length: 30 }, (_, index) => {
  const id = index + 1
  return {
    id,
    variant: id === 9 ? 'Tall_100%' : id === 10 ? 'Tall 1000' : `${id % 2 === 0 ? 'variant' : 'Variant'} ${String(id).padStart(2, '0')}`,
    type: TYPES[id % 3]!,
    description: id === 17 ? 'Woven from RAFFIA' : null,
    status: STATUSES[id % 3]!,
    productId: id % 4 === 0 ? 515 : id % 4 === 1 ? 2 : null,
    ...optionsOf(id),
  }
})
type Variant = typeof VARIANTS[number]

const ids = (variants: Variant[]) => variants.map(variant => String(variant.id))
const byName = (a: Variant, b: Variant) => a.variant.toLowerCase().localeCompare(b.variant.toLowerCase()) || a.id - b.id

function query(overrides: Partial<ProductVariantListQuery> = {}): ProductVariantListQuery {
  return { search: '', status: '', type: '', product: '', sort: 'variant', direction: 'asc', page: 1, perPage: 10, ...overrides }
}

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  const rows = (count: number, columns: number) => Array.from({ length: count }, (_, i) => `(${Array.from({ length: columns }, (_, c) => p(i * columns + c + 1)).join(', ')})`).join(', ')
  let status = text
  if (dialect === 'postgres') {
    await run(`CREATE TYPE variant_status AS ENUM ('active', 'inactive', 'draft')`)
    status = 'variant_status'
  }
  if (dialect === 'mysql')
    status = `ENUM('active', 'inactive', 'draft')`
  await run(`CREATE TABLE products (id ${pk}, name ${text})`)
  await run(`CREATE TABLE product_variants (id ${pk}, variant ${text}, type ${text}, description ${text} NULL, options ${text} NULL, status ${status}, product_id INTEGER NULL, created_at ${time})`)
  const all = Array.from({ length: PRODUCTS }, (_, i) => i + 1)
  await run(`INSERT INTO products (id, name) VALUES ${rows(PRODUCTS, 2)}`, all.flatMap(id => [id, productName(id)]))
  await run(
    `INSERT INTO product_variants (id, variant, type, description, options, status, product_id, created_at) VALUES ${rows(VARIANTS.length, 8)}`,
    VARIANTS.flatMap(variant => [variant.id, variant.variant, variant.type, variant.description, variant.stored, variant.status, variant.productId, `2026-10-${String(1 + variant.id % 28).padStart(2, '0')} 09:00:00`]),
  )
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const read = (overrides: Partial<ProductVariantListQuery> = {}) => readProductVariantPage(query(overrides), runner, dialect)
  const all = async (overrides: Partial<ProductVariantListQuery> = {}) => (await read({ perPage: 100, ...overrides })).records.map(record => record.id)
  const matching = (keep: (variant: Variant) => boolean) => ids(VARIANTS.filter(keep).sort(byName))

  // The summary and choices describe every variant, whatever the page is filtered to.
  const filtered = await read({ status: 'inactive' })
  expect(filtered.summary).toEqual({
    total: VARIANTS.length,
    active: VARIANTS.filter(variant => variant.status === 'active').length,
    draft: VARIANTS.filter(variant => variant.status === 'draft').length,
    linkedProducts: 2,
  })
  expect(filtered.types).toEqual(['Color', 'material', 'size'])
  expect(filtered.products).toEqual([{ id: '2', name: 'Apron' }, { id: '515', name: 'zebra Tea' }])
  expect(filtered.total).toBe(VARIANTS.filter(variant => variant.status === 'inactive').length)

  // Filters and search: a literal %, the description, the product and the options text.
  expect(await all({ product: '515' })).toEqual(matching(variant => variant.productId === 515))
  expect(await all({ type: 'Color', status: 'draft' })).toEqual(matching(variant => variant.type === 'Color' && variant.status === 'draft'))
  expect(await all({ search: '100%' })).toEqual(['9'])
  expect(await all({ search: 'raffia' })).toEqual(['17'])
  expect(await all({ search: 'ZEBRA' })).toEqual(matching(variant => variant.productId === 515))
  expect(await all({ search: 'opt4' })).toEqual(matching(variant => variant.count >= 4))

  // By name ignoring case, stable across pages.
  const pages = [await read({ page: 1 }), await read({ page: 2 }), await read({ page: 3 })]
  expect(pages.flatMap(result => result.records.map(record => record.id))).toEqual(ids([...VARIANTS].sort(byName)))

  // Most options first, whatever the list is stored as; ties by name.
  expect(await all({ sort: 'options', direction: 'desc' })).toEqual(ids([...VARIANTS].sort((a, b) => b.count - a.count || byName(a, b))))
  const product = (variant: Variant) => variant.productId ? productName(variant.productId).toLowerCase() : ''
  expect(await all({ sort: 'product' })).toEqual(ids([...VARIANTS].sort((a, b) => product(a).localeCompare(product(b)) || byName(a, b))))
  expect(await all({ sort: 'status' })).toEqual(ids([...VARIANTS].sort((a, b) => a.status.localeCompare(b.status) || byName(a, b))))

  // The records parse every stored form; a product past the 500th is named.
  const records = (await read({ perPage: 100 })).records
  for (const variant of VARIANTS)
    expect(records.find(record => record.id === String(variant.id))?.options.length).toBe(variant.count)
  expect(records.find(record => record.productId === '515')?.productName).toBe('zebra Tea')
}

describe('readProductVariantPage on SQLite', () => {
  test('summary, choices, filters, search, sorts, pages and products', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readProductVariantPage on ${dialect}: summary, choices, filters, search, sorts, pages and products`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Product variant list tests require a local disposable database server')

    const name = `stacks_product_variants_${crypto.randomUUID().replaceAll('-', '')}`
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    const admin = new SQL({ url: url.href, database: decodeURIComponent(url.pathname.slice(1)) || undefined })
    await admin.unsafe(`CREATE DATABASE ${quoted}`)
    const scoped = new URL(url.href)
    scoped.pathname = `/${name}`
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

describe('parseProductVariantListQuery', () => {
  const reader = (values: Record<string, unknown>) => (key: string) => values[key] ?? ''

  test('defaults to every variant by name, 25 a page', () => {
    expect(parseProductVariantListQuery(reader({}))).toEqual({ search: '', status: '', type: '', product: '', sort: 'variant', direction: 'asc', page: 1, perPage: 25 })
    expect(parseProductVariantListQuery(reader({ sort: 'options' }))).toHaveProperty('direction', 'desc')
  })

  test('refuses values the page does not offer', () => {
    expect(parseProductVariantListQuery(reader({ status: 'archived' }))).toHaveProperty('error')
    expect(parseProductVariantListQuery(reader({ product: 'tea' }))).toHaveProperty('error')
    expect(parseProductVariantListQuery(reader({ sort: 'sku' }))).toHaveProperty('error')
  })
})
