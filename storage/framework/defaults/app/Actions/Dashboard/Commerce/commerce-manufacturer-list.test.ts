import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import { readManufacturers } from './commerce-manufacturer-list'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The manufacturers against each dialect's real engine (stacksjs/stacks#3218),
 * over 520 manufacturers and 1,200 products: the page used to read the newest
 * 500 manufacturers and count over the first 500 products.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'
type Run = (sql: string, values?: unknown[]) => Promise<unknown>

const MANUFACTURERS = Array.from({ length: 520 }, (_, index) => {
  const id = index + 1
  return { id, name: `Maker ${String(id).padStart(3, '0')}`, country: `Country ${id % 7}`, featured: id % 5 === 0 }
})

/** Every fourth product has no manufacturer; the rest spread over all 520, the oldest included. */
const PRODUCTS = Array.from({ length: 1200 }, (_, index) => {
  const id = index + 1
  return { id, manufacturerId: id % 4 === 0 ? null : ((id * 7) % 520) + 1 }
})

function placeholders(rows: number, columns: number, dialect: Dialect): string {
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  return Array.from({ length: rows }, (_, row) => `(${Array.from({ length: columns }, (_, column) => p(row * columns + column + 1)).join(', ')})`).join(', ')
}

async function setUp(run: Run, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const bool = dialect === 'postgres' ? 'BOOLEAN' : dialect === 'mysql' ? 'TINYINT(1)' : 'INTEGER'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  await run(`CREATE TABLE manufacturers (id ${pk}, manufacturer ${text}, description ${text} NULL, country ${text}, featured ${bool}, created_at ${time})`)
  await run(`CREATE TABLE products (id ${pk}, name ${text}, manufacturer_id INTEGER NULL)`)
  await run(
    `INSERT INTO manufacturers (id, manufacturer, country, featured, created_at) VALUES ${placeholders(MANUFACTURERS.length, 5, dialect)}`,
    MANUFACTURERS.flatMap(maker => [maker.id, maker.name, maker.country, dialect === 'postgres' ? maker.featured : (maker.featured ? 1 : 0), '2026-11-01 09:00:00']),
  )
  await run(
    `INSERT INTO products (id, name, manufacturer_id) VALUES ${placeholders(PRODUCTS.length, 3, dialect)}`,
    PRODUCTS.flatMap(product => [product.id, `Product ${product.id}`, product.manufacturerId]),
  )
}

async function exercise(runner: CommerceSqlRunner, run: Run, dialect: Dialect) {
  const { records, summary } = await readManufacturers(runner)

  // Every manufacturer, newest first, the oldest included.
  expect(records.map(record => record.id)).toEqual(MANUFACTURERS.map(maker => String(maker.id)).reverse())
  expect(records.at(-1)).toMatchObject({ id: '1', name: 'Maker 001', country: 'Country 1', featured: false })

  // Each count is over every product, not the first 500.
  const expected = new Map<string, number>()
  for (const product of PRODUCTS) {
    if (product.manufacturerId)
      expected.set(String(product.manufacturerId), (expected.get(String(product.manufacturerId)) ?? 0) + 1)
  }
  expect(Object.fromEntries(records.map(record => [record.id, record.productCount])))
    .toEqual(Object.fromEntries(MANUFACTURERS.map(maker => [String(maker.id), expected.get(String(maker.id)) ?? 0])))
  // A product past the 500th counts for its manufacturer.
  const late = PRODUCTS.find(product => product.id > 500 && product.manufacturerId)!
  expect(records.find(record => record.id === String(late.manufacturerId))!.productCount).toBeGreaterThan(0)

  expect(summary).toEqual({
    total: 520,
    featured: MANUFACTURERS.filter(maker => maker.featured).length,
    countries: 7,
    linkedProducts: PRODUCTS.filter(product => product.manufacturerId).length,
  })

  // A product naming a manufacturer that does not exist still fails the page,
  // named by the first such product, wherever it is.
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  await run(`INSERT INTO products (id, name, manufacturer_id) VALUES (${p(1)}, ${p(2)}, ${p(3)}), (${p(4)}, ${p(5)}, ${p(6)})`, [1300, 'Orphan B', 999, 1250, 'Orphan A', 999])
  await expect(readManufacturers(runner)).rejects.toThrow('Product 1250.manufacturer_id references missing Manufacturer 999.')
}

describe('readManufacturers on SQLite', () => {
  test('every manufacturer, with products counted over every product', async () => {
    const database = new Database(':memory:')
    const run: Run = async (sql, values = []) => database.query(sql).run(...(values as never[]))
    await setUp(run, 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, run, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readManufacturers on ${dialect}: every manufacturer, with products counted over every product`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Manufacturer list tests require a local disposable database server')

    const name = `stacks_manufacturers_${crypto.randomUUID().replaceAll('-', '')}`
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
