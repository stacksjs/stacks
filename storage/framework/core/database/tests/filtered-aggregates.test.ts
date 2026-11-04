/**
 * A filtered aggregate (`db.fn.count('id').filterWhere(...)`) must run on
 * every dialect. It rendered `COUNT(id) FILTER (WHERE …)`, which MySQL does
 * not have, so receipt and print-device stats were a syntax error there
 * (stacksjs/stacks#3182).
 *
 * The rendered fragments run for real: SQLite in memory always, PostgreSQL
 * and MySQL in a disposable database when STACKS_TEST_POSTGRES_URL /
 * STACKS_TEST_MYSQL_URL name a local server.
 */

import { Database } from 'bun:sqlite'
import process from 'node:process'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import { aggregateFunctions as fn } from '../src/types'

const ROWS = [
  { id: 1, status: 'success', amount: 10 },
  { id: 2, status: 'failed', amount: 20 },
  { id: 3, status: 'success', amount: 30 },
  { id: 4, status: 'warning', amount: 40 },
  { id: 5, status: 'success', amount: 50 },
]

const SELECTED = [
  fn.count('id').as('total'),
  fn.count('id').filterWhere('status', '=', 'success').as('success'),
  fn.countAll().filterWhere('status', '!=', 'success').as('other'),
  fn.sum('amount').filterWhere('status', '=', 'success').as('success_amount'),
  fn.avg('amount').filterWhere('status', '=', 'success').as('success_average'),
  fn.min('amount').filterWhere('status', '=', 'success').as('success_min'),
  fn.max('amount').filterWhere('status', '=', 'failed').as('failed_max'),
  fn.count('id').filterWhere('status', '=', 'success').filterWhere('amount', '>', 15).as('large_success'),
  fn.count('id').filterWhere('status', '=', 'missing').as('none'),
]

const EXPECTED = { total: 5, success: 3, other: 2, success_amount: 90, success_average: 30, success_min: 10, failed_max: 20, large_success: 2, none: 0 }

const QUERY = `SELECT ${SELECTED.map(expression => expression.sql).join(', ')} FROM stats_rows`

function numbers(row: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]))
}

describe('filtered aggregates', () => {
  test('render without a FILTER clause', () => {
    expect(fn.count('id').filterWhere('status', '=', 'failed').as('failed_count').sql)
      .toBe(`COUNT(CASE WHEN status = 'failed' THEN id END) AS failed_count`)
    expect(fn.countAll().filterWhere('status', '=', 'online').sql).toBe(`COUNT(CASE WHEN status = 'online' THEN 1 END)`)
    expect(fn.count('id').as('total').sql).toBe('COUNT(id) AS total')
    expect(QUERY).not.toContain('FILTER')
  })

  test('sqlite answers every aggregate', () => {
    const database = new Database(':memory:')
    try {
      database.run('CREATE TABLE stats_rows (id INTEGER, status TEXT, amount INTEGER)')
      for (const row of ROWS)
        database.run('INSERT INTO stats_rows VALUES (?, ?, ?)', [row.id, row.status, row.amount])
      expect(numbers(database.query(QUERY).get() as Record<string, unknown>)).toEqual(EXPECTED)
    }
    finally { database.close() }
  })

  for (const dialect of ['postgres', 'mysql'] as const) {
    const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL
    test.skipIf(!connection)(`${dialect} answers every aggregate`, async () => {
      const url = new URL(connection!)
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
        throw new Error('Filtered aggregate tests require a local disposable database server')
      const name = `stacks_filtered_aggregates_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
      const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
      const admin = new SQL(url.href)
      let created = false
      try {
        await admin.unsafe(`CREATE DATABASE ${quoted}`)
        created = true
        const target = new URL(url.href)
        target.pathname = `/${name}`
        const database = new SQL(target.href)
        try {
          await database.unsafe('CREATE TABLE stats_rows (id INTEGER, status VARCHAR(20), amount INTEGER)')
          for (const row of ROWS)
            await database.unsafe(`INSERT INTO stats_rows VALUES (${row.id}, '${row.status}', ${row.amount})`)
          const [row] = await database.unsafe(QUERY)
          expect(numbers(row)).toEqual(EXPECTED)
        }
        finally { await database.close() }
      }
      finally {
        try { if (created) await admin.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
        finally { await admin.close() }
      }
    }, 30_000)
  }
})
