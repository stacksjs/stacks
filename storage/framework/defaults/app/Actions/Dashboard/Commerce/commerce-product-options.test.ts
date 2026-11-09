import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import { readProductOptions } from './commerce-product-list'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The category and manufacturer choices the Products page and each product's
 * own page offer, against each dialect's real engine (stacksjs/stacks#3218).
 * The product page used to read the first 500 of each by name; there are 520
 * of each here, named so the last by id sorts first and case is ignored.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'
type Run = (sql: string, values?: unknown[]) => Promise<unknown>

const ROWS = 520

/** Row n is named so that id order and name order run opposite ways, every other one in capitals. */
function nameOf(prefix: string, id: number): string {
  const name = `${prefix} ${String(ROWS + 1 - id).padStart(3, '0')}`
  return id % 2 === 0 ? name.toUpperCase() : name
}

async function setUp(run: Run, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  const rows = Array.from({ length: ROWS }, (_, row) => `(${p(row * 2 + 1)}, ${p(row * 2 + 2)})`).join(', ')
  await run(`CREATE TABLE categories (id ${pk}, name ${text})`)
  await run(`CREATE TABLE manufacturers (id ${pk}, manufacturer ${text})`)
  const ids = Array.from({ length: ROWS }, (_, index) => index + 1)
  await run(`INSERT INTO categories (id, name) VALUES ${rows}`, ids.flatMap(id => [id, nameOf('Category', id)]))
  await run(`INSERT INTO manufacturers (id, manufacturer) VALUES ${rows}`, ids.flatMap(id => [id, nameOf('Maker', id)]))
}

async function exercise(runner: CommerceSqlRunner) {
  const { categories, manufacturers } = await readProductOptions(runner)
  // All 520 of each, by name ignoring case: the newest id first.
  const expected = Array.from({ length: ROWS }, (_, index) => String(ROWS - index))
  expect(categories.map(option => option.id)).toEqual(expected)
  expect(manufacturers.map(option => option.id)).toEqual(expected)
  expect(categories[0]).toEqual({ id: '520', label: 'CATEGORY 001' })
  expect(manufacturers.at(-1)).toEqual({ id: '1', label: 'Maker 520' })
}

describe('readProductOptions on SQLite', () => {
  test('every category and manufacturer, by name', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) })
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readProductOptions on ${dialect}: every category and manufacturer, by name`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Product option tests require a local disposable database server')

    const name = `stacks_product_options_${crypto.randomUUID().replaceAll('-', '')}`
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    const admin = new SQL({ url: url.href, database: decodeURIComponent(url.pathname.slice(1)) || undefined })
    await admin.unsafe(`CREATE DATABASE ${quoted}`)
    const scoped = new URL(url.href)
    scoped.pathname = `/${name}`
    // Explicit database wins over inherited PGDATABASE / MYSQL_DATABASE in CI.
    const database = new SQL({ url: scoped.href, database: name })

    try {
      await setUp(async (sql, values = []) => await database.unsafe(sql, values), dialect)
      await exercise({ unsafe: (sql, values = []) => ({ execute: async () => await database.unsafe(sql, values) }) })
    }
    finally {
      await database.close()
      try { await admin.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
      finally { await admin.close() }
    }
  }, 60_000)
}
