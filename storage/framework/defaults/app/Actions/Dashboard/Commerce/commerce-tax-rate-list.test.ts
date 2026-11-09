import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { CommerceSqlRunner } from './commerce-sql'
import { readTaxRates } from './commerce-tax-rate-list'

/**
 * The tax rates against each dialect's real engine (stacksjs/stacks#3218),
 * over 520 of them: the page used to read the newest 500.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const ROWS = 520
const REGIONS = ['North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania', 'Antarctica'] as const

/** 26 countries; rates 1 and 520 are both defaults, a conflict the newest 500 could not see. */
const RATES = Array.from({ length: ROWS }, (_, index) => {
  const id = index + 1
  return {
    id,
    name: `Rate ${id}`,
    rate: (id % 40) / 2,
    type: id % 3 === 0 ? 'vat' : 'sales',
    country: `C${String.fromCharCode(65 + (id % 26))}`,
    region: REGIONS[id % REGIONS.length]!,
    status: id % 4 === 0 ? 'inactive' : 'active',
    isDefault: id === 1 || id === ROWS,
  }
})

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const bool = dialect === 'postgres' ? 'BOOLEAN' : dialect === 'mysql' ? 'TINYINT(1)' : 'INTEGER'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  const columns = 9
  await run(`CREATE TABLE tax_rates (id ${pk}, name ${text}, rate REAL, type ${text}, country ${text}, region ${text}, status ${text}, is_default ${bool}, created_at ${time})`)
  await run(
    `INSERT INTO tax_rates (id, name, rate, type, country, region, status, is_default, created_at) VALUES ${RATES.map((_, i) => `(${Array.from({ length: columns }, (_, c) => p(i * columns + c + 1)).join(', ')})`).join(', ')}`,
    RATES.flatMap(rate => [
      rate.id, rate.name, rate.rate, rate.type, rate.country, rate.region, rate.status,
      dialect === 'postgres' ? rate.isDefault : (rate.isDefault ? 1 : 0), '2026-11-01 09:00:00',
    ]),
  )
}

async function exercise(runner: CommerceSqlRunner) {
  const { records, summary } = await readTaxRates(runner)

  // Every rate, newest first, the oldest included.
  expect(records.map(record => record.id)).toEqual(RATES.map(rate => String(rate.id)).reverse())
  expect(records.at(-1)).toMatchObject({ id: '1', name: 'Rate 1', rate: 0.5, country: 'CB', region: 'South America', isDefault: true })

  expect(summary).toEqual({
    total: ROWS,
    active: RATES.filter(rate => rate.status === 'active').length,
    countries: 26,
    averageRate: RATES.reduce((sum, rate) => sum + rate.rate, 0) / ROWS,
    defaultConflicts: 1,
  })
}

describe('readTaxRates on SQLite', () => {
  test('every tax rate, newest first, with the summary of all of them', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) })
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readTaxRates on ${dialect}: every tax rate, newest first, with the summary of all of them`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Tax rate list tests require a local disposable database server')

    const name = `stacks_tax_rates_${crypto.randomUUID().replaceAll('-', '')}`
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
