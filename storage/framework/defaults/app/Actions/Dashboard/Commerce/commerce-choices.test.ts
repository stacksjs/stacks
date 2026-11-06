import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import { searchCustomerChoices, searchProductChoices } from './commerce-choices'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The commerce dialogs' product and customer searches against each dialect's
 * real engine (stacksjs/stacks#3218), over 600 of each: the waitlist dialogs
 * used to be handed the first 500.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const ROWS = 600
const productName = (id: number) => id === 600 ? 'Zebra Tea' : id === 7 ? 'apple_50% off' : id === 8 ? 'apple 500 box' : `Product ${String(id).padStart(3, '0')}`
const customerName = (id: number) => id === 599 ? 'mia Late' : id === 3 ? 'Mia early' : `Customer ${String(id).padStart(3, '0')}`

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  await run(`CREATE TABLE products (id ${pk}, name ${text}, inventory_count INTEGER)`)
  await run(`CREATE TABLE customers (id ${pk}, name ${text}, email ${text}, phone ${text} NULL)`)
  const all = Array.from({ length: ROWS }, (_, i) => i + 1)
  await run(`INSERT INTO products (id, name, inventory_count) VALUES ${all.map((_, i) => `(${p(3 * i + 1)}, ${p(3 * i + 2)}, ${p(3 * i + 3)})`).join(', ')}`, all.flatMap(id => [id, productName(id), id % 9]))
  await run(`INSERT INTO customers (id, name, email, phone) VALUES ${all.map((_, i) => `(${p(4 * i + 1)}, ${p(4 * i + 2)}, ${p(4 * i + 3)}, ${p(4 * i + 4)})`).join(', ')}`, all.flatMap(id => [id, customerName(id), `buyer${id}@shop.test`, id === 444 ? '+1 555 0444' : null]))
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const products = (search: string, limit = 25) => searchProductChoices({ search, limit }, runner, dialect)
  const customers = (search: string, limit = 25) => searchCustomerChoices({ search, limit }, runner, dialect)

  // Unsearched: bounded, by name ignoring case, with how many there are.
  const first = await products('')
  expect(first.total).toBe(ROWS)
  expect(first.choices.length).toBe(25)
  expect(first.choices.slice(0, 2).map(choice => choice.label)).toEqual(['apple 500 box', 'apple_50% off'])

  // The 600th of each can be found, and a literal % matches only itself.
  expect(await products('zebra')).toEqual({ choices: [{ id: '600', label: 'Zebra Tea', detail: '6 in inventory' }], total: 1 })
  expect((await products('50%')).choices.map(choice => choice.id)).toEqual(['7'])
  expect((await products('600')).choices.map(choice => choice.id)).toEqual(['600'])
  expect((await customers('MIA')).choices.map(choice => choice.label)).toEqual(['Mia early', 'mia Late'])
  expect((await customers('buyer599@')).choices).toEqual([{ id: '599', label: 'mia Late', detail: 'buyer599@shop.test', email: 'buyer599@shop.test', phone: '' }])
  expect((await customers('0444')).choices.map(choice => choice.id)).toEqual(['444'])

  // The limit bounds the choices, not the count.
  const bounded = await customers('customer', 5)
  expect(bounded.choices.length).toBe(5)
  expect(bounded.total).toBe(ROWS - 2)
}

describe('commerce choices on SQLite', () => {
  test('products and customers by name, email, phone and id', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`commerce choices on ${dialect}: products and customers by name, email, phone and id`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Commerce choice tests require a local disposable database server')

    const name = `stacks_commerce_choices_${crypto.randomUUID().replaceAll('-', '')}`
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
