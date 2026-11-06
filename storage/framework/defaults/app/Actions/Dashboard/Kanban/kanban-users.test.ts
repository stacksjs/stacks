import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { KanbanUserRunner } from './kanban-users'
import { containsPattern } from '../Content/content-list'
import { parseKanbanUserQuery, readKanbanUsers } from './kanban-users'

/**
 * The assignee picker's search, against each dialect's real engine
 * (stacksjs/stacks#3216): case-insensitive over name and email, wildcards
 * taken literally, bounded, with the full match count.
 */
const USERS: Array<[string | null, string]> = [
  ['Ava Stone', 'ava@example.com'],
  ['ben carter', 'BEN@Example.com'],
  ['Cara 100% Sure', 'cara@example.com'],
  ['Dan_Under', 'dan@example.com'],
  // These two are what an unescaped pattern would wrongly match: `n_u` with
  // `_` as a wildcard matches "n u", and `100%` matches "1000".
  ['Dan Under', 'danunder@example.com'],
  ['Cara 1000 Sure', 'cara1000@example.com'],
  ['Dana Undertow', 'dana@example.com'],
  [null, 'nameless@example.com'],
  ['Émile Zola', 'emile@example.com'],
]

async function exercise(run: KanbanUserRunner, dialect: 'sqlite' | 'postgres' | 'mysql') {
  const read = (q: string, limit = 25) => readKanbanUsers({ search: q, limit }, run, dialect)

  const all = await read('')
  expect(all.total).toBe(USERS.length)
  expect(all.users.map(user => user.email)).toContain('nameless@example.com')

  // Case is ignored on both columns.
  expect((await read('BEN')).users.map(user => user.email)).toEqual(['BEN@Example.com'])
  expect((await read('example.com')).total).toBe(USERS.length)

  // `%` and `_` are characters to find, not wildcards.
  expect((await read('100%')).users.map(user => user.name)).toEqual(['Cara 100% Sure'])
  expect((await read('n_u')).users.map(user => user.name)).toEqual(['Dan_Under'])

  // A user with no name is found by email.
  expect((await read('nameless')).users).toEqual([expect.objectContaining({ name: null, email: 'nameless@example.com' })])

  // The limit bounds the rows; the total still counts every match.
  const limited = await read('a', 2)
  expect(limited.users).toHaveLength(2)
  expect(limited.total).toBeGreaterThan(2)

  // Nothing matches is an empty page, not an error.
  expect(await read('zzzz-nobody')).toEqual({ users: [], total: 0 })
}

describe('readKanbanUsers on SQLite', () => {
  test('searches, bounds and counts', async () => {
    const database = new Database(':memory:')
    database.run('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)')
    for (const [name, email] of USERS)
      database.query('INSERT INTO users (name, email) VALUES (?, ?)').run(name, email)
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as string[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readKanbanUsers on ${dialect} searches, bounds and counts`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Kanban user tests require a local disposable database server')

    const name = `stacks_kanban_users_${crypto.randomUUID().replaceAll('-', '')}`
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    const admin = new SQL({ url: url.href, database: decodeURIComponent(url.pathname.slice(1)) || undefined })
    await admin.unsafe(`CREATE DATABASE ${quoted}`)
    const scoped = new URL(url.href)
    scoped.pathname = `/${name}`
    // Explicit database wins over inherited PGDATABASE / MYSQL_DATABASE in CI.
    const database = new SQL({ url: scoped.href, database: name })

    try {
      await database.unsafe(dialect === 'mysql'
        ? 'CREATE TABLE users (id INTEGER PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NULL, email VARCHAR(255) NULL) CHARACTER SET utf8mb4'
        : 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT, email TEXT)')
      for (const [userName, email] of USERS)
        await database.unsafe(`INSERT INTO users (name, email) VALUES (${dialect === 'postgres' ? '$1, $2' : '?, ?'})`, [userName, email])
      await exercise({ unsafe: (sql, values = []) => ({ execute: async () => await database.unsafe(sql, values) }) }, dialect)
    }
    finally {
      await database.close()
      try { await admin.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
      finally { await admin.close() }
    }
  }, 30_000)
}

describe('parseKanbanUserQuery', () => {
  const reader = (values: Record<string, unknown>) => (key: string) => values[key] ?? ''

  test('defaults to an unfiltered page of 25', () => {
    expect(parseKanbanUserQuery(reader({}))).toEqual({ search: '', limit: 25 })
  })

  test('rejects a limit out of range and an over-long search', () => {
    expect(parseKanbanUserQuery(reader({ limit: '0' }))).toHaveProperty('error')
    expect(parseKanbanUserQuery(reader({ limit: '101' }))).toHaveProperty('error')
    expect(parseKanbanUserQuery(reader({ limit: 'ten' }))).toHaveProperty('error')
    expect(parseKanbanUserQuery(reader({ q: 'x'.repeat(201) }))).toHaveProperty('error')
  })

  test('the pattern escapes its own wildcards and lowercases', () => {
    expect(containsPattern('A_b%c!d')).toBe('%a!_b!%c!!d%')
  })
})
