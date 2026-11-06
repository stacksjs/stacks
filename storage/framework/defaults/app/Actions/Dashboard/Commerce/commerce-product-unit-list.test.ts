import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { ProductUnitListQuery } from './commerce-product-unit-list'
import { parseProductUnitListQuery, readProductUnitPage } from './commerce-product-unit-list'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The Units list against each dialect's real engine (stacksjs/stacks#3218),
 * with is_default as each dialect stores a boolean and products past the 500
 * the page used to read.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const PRODUCTS = 520
const TYPES = ['weight', 'Volume', 'count'] as const
const productName = (id: number) => id === 515 ? 'zebra Tea' : `Product ${String(id).padStart(3, '0')}`

/** 30 units; weight has two defaults and Volume three, so two types conflict; count has one, which does not. */
const UNITS = Array.from({ length: 30 }, (_, index) => {
  const id = index + 1
  return {
    id,
    name: id === 9 ? 'Half_100%' : id === 10 ? 'Half 1000' : `${id % 2 === 0 ? 'unit' : 'Unit'} ${String(id).padStart(2, '0')}`,
    abbreviation: `u${id}`,
    type: TYPES[id % 3]!,
    description: id === 17 ? 'Sold LOOSE by the scoop' : null,
    isDefault: [3, 6, 4, 7, 10, 5].includes(id),
    productId: id % 4 === 0 ? 515 : id % 4 === 1 ? 2 : null,
  }
})
type Unit = typeof UNITS[number]

const ids = (units: Unit[]) => units.map(unit => String(unit.id))
const byName = (a: Unit, b: Unit) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id - b.id

function query(overrides: Partial<ProductUnitListQuery> = {}): ProductUnitListQuery {
  return { search: '', type: '', isDefault: '', sort: 'name', direction: 'asc', page: 1, perPage: 10, ...overrides }
}

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const bool = dialect === 'postgres' ? 'BOOLEAN' : dialect === 'mysql' ? 'TINYINT(1)' : 'INTEGER'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  const rows = (count: number, columns: number) => Array.from({ length: count }, (_, i) => `(${Array.from({ length: columns }, (_, c) => p(i * columns + c + 1)).join(', ')})`).join(', ')
  await run(`CREATE TABLE products (id ${pk}, name ${text})`)
  await run(`CREATE TABLE product_units (id ${pk}, name ${text}, abbreviation ${text}, type ${text}, description ${text} NULL, is_default ${bool}, product_id INTEGER NULL, created_at ${time})`)
  const all = Array.from({ length: PRODUCTS }, (_, i) => i + 1)
  await run(`INSERT INTO products (id, name) VALUES ${rows(PRODUCTS, 2)}`, all.flatMap(id => [id, productName(id)]))
  await run(
    `INSERT INTO product_units (id, name, abbreviation, type, description, is_default, product_id, created_at) VALUES ${rows(UNITS.length, 8)}`,
    UNITS.flatMap(unit => [unit.id, unit.name, unit.abbreviation, unit.type, unit.description, dialect === 'postgres' ? unit.isDefault : (unit.isDefault ? 1 : 0), unit.productId, `2026-10-${String(1 + unit.id % 28).padStart(2, '0')} 09:00:00`]),
  )
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const read = (overrides: Partial<ProductUnitListQuery> = {}) => readProductUnitPage(query(overrides), runner, dialect)
  const all = async (overrides: Partial<ProductUnitListQuery> = {}) => (await read({ perPage: 100, ...overrides })).records.map(record => record.id)
  const matching = (keep: (unit: Unit) => boolean) => ids(UNITS.filter(keep).sort(byName))

  // The summary and the types describe every unit, whatever the page is filtered to.
  const filtered = await read({ type: 'count' })
  expect(filtered.summary).toEqual({
    total: UNITS.length,
    defaults: UNITS.filter(unit => unit.isDefault).length,
    types: TYPES.length,
    linkedProducts: new Set(UNITS.map(unit => unit.productId).filter(Boolean)).size,
    defaultConflicts: 2,
  })
  expect(filtered.types).toEqual(['Volume', 'count', 'weight'])
  expect(filtered.total).toBe(UNITS.filter(unit => unit.type === 'count').length)

  // Filters and search: names with a literal %, descriptions and product names, ignoring case.
  expect(await all({ isDefault: 'default' })).toEqual(matching(unit => unit.isDefault))
  expect(await all({ isDefault: 'not-default', type: 'weight' })).toEqual(matching(unit => !unit.isDefault && unit.type === 'weight'))
  expect(await all({ search: '100%' })).toEqual(['9'])
  expect(await all({ search: 'loose' })).toEqual(['17'])
  expect(await all({ search: 'ZEBRA' })).toEqual(matching(unit => unit.productId === 515))

  // By name ignoring case, stable across pages.
  const named = [...UNITS].sort(byName)
  const pages = [await read({ page: 1 }), await read({ page: 2 }), await read({ page: 3 })]
  expect(pages.flatMap(result => result.records.map(record => record.id))).toEqual(ids(named))
  expect((await read({ page: 9 })).page).toBe(3)

  // Type and product sorts read ties by name; newest is the id.
  expect(await all({ sort: 'type' })).toEqual(ids([...UNITS].sort((a, b) => a.type.toLowerCase().localeCompare(b.type.toLowerCase()) || byName(a, b))))
  const product = (unit: Unit) => unit.productId ? productName(unit.productId).toLowerCase() : ''
  expect(await all({ sort: 'product' })).toEqual(ids([...UNITS].sort((a, b) => product(a).localeCompare(product(b)) || byName(a, b))))
  expect(await all({ sort: 'newest', direction: 'desc' })).toEqual(ids([...UNITS].sort((a, b) => b.id - a.id)))

  // A product past the 500th, read by the ids the page references.
  expect((await read({ search: 'zebra' })).records[0]).toMatchObject({ productId: '515', productName: 'zebra Tea' })
}

describe('readProductUnitPage on SQLite', () => {
  test('summary, types, filters, search, sorts, pages and products', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readProductUnitPage on ${dialect}: summary, types, filters, search, sorts, pages and products`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Product unit list tests require a local disposable database server')

    const name = `stacks_product_units_${crypto.randomUUID().replaceAll('-', '')}`
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

describe('parseProductUnitListQuery', () => {
  const reader = (values: Record<string, unknown>) => (key: string) => values[key] ?? ''

  test('defaults to every unit by name, 25 a page', () => {
    expect(parseProductUnitListQuery(reader({}))).toEqual({ search: '', type: '', isDefault: '', sort: 'name', direction: 'asc', page: 1, perPage: 25 })
    expect(parseProductUnitListQuery(reader({ sort: 'newest' }))).toHaveProperty('direction', 'desc')
  })

  test('refuses values the page does not offer', () => {
    expect(parseProductUnitListQuery(reader({ default: 'yes' }))).toHaveProperty('error')
    expect(parseProductUnitListQuery(reader({ sort: 'abbreviation' }))).toHaveProperty('error')
  })
})
