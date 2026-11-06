import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import { readCommerceCategories } from './commerce-category-list'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The product categories against each dialect's real engine
 * (stacksjs/stacks#3218), over 520 of them: the page used to read the first
 * 500 by display order.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const ROWS = 520

/** Category n shows in display order n, except 11, which ties with 10; 3's parent is the last one shown. */
const CATEGORIES = Array.from({ length: ROWS }, (_, index) => {
  const id = index + 1
  return {
    id,
    name: `Category ${String(id).padStart(3, '0')}`,
    displayOrder: id === 11 ? 10 : id,
    parentId: id === 3 ? 520 : id % 10 === 0 ? 1 : null,
    active: id % 4 !== 0,
  }
})

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const bool = dialect === 'postgres' ? 'BOOLEAN' : dialect === 'mysql' ? 'TINYINT(1)' : 'INTEGER'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  const columns = 7
  await run(`CREATE TABLE categories (id ${pk}, name ${text}, description ${text} NULL, slug ${text}, image_url ${text} NULL, is_active ${bool}, parent_category_id INTEGER NULL, display_order INTEGER, created_at ${time})`)
  await run(
    `INSERT INTO categories (id, name, slug, is_active, parent_category_id, display_order, created_at) VALUES ${CATEGORIES.map((_, i) => `(${Array.from({ length: columns }, (_, c) => p(i * columns + c + 1)).join(', ')})`).join(', ')}`,
    CATEGORIES.flatMap(category => [
      category.id, category.name, `category-${category.id}`, dialect === 'postgres' ? category.active : (category.active ? 1 : 0),
      category.parentId, category.displayOrder, '2026-11-01 09:00:00',
    ]),
  )
}

async function exercise(runner: CommerceSqlRunner) {
  const { records, summary } = await readCommerceCategories(runner)

  // Every category, in display order, the id breaking the tie between 10 and 11.
  expect(records.length).toBe(ROWS)
  expect(records.map(record => record.id)).toEqual(
    [...CATEGORIES].sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id).map(category => String(category.id)),
  )
  // A parent shown after the 500th is found.
  expect(records.find(record => record.id === '3')?.parentCategoryId).toBe('520')

  const roots = CATEGORIES.filter(category => !category.parentId).length
  expect(summary).toMatchObject({
    total: ROWS,
    active: CATEGORIES.filter(category => category.active).length,
    roots,
    children: ROWS - roots,
  })
}

describe('readCommerceCategories on SQLite', () => {
  test('every category, in display order, with parents past the 500th', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) })
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readCommerceCategories on ${dialect}: every category, in display order, with parents past the 500th`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Category list tests require a local disposable database server')

    const name = `stacks_categories_${crypto.randomUUID().replaceAll('-', '')}`
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
