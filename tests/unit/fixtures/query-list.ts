/**
 * Runs `readQueryLogPage` against a disposable database of the given dialect,
 * with `query_logs` built from the QueryLog model, and checks every answer
 * against one computed here from the seed (stacksjs/stacks#3204).
 */

import assert from 'node:assert/strict'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_QUERY_LIST_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-query-list-'))
if (dialect === 'sqlite') {
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
}
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_query_list_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  },
  queryLogging: { enabled: false },
} })

const { buildMigrationPlan, generateSql, loadModels } = await import('bun-query-builder')
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../storage/framework/defaults/app/Models') }), { dialect })
plan.tables = plan.tables.filter(table => table.table === 'query_logs')
assert.equal(plan.tables.length, 1)
for (const column of plan.tables[0]!.columns)
  delete column.references

const { sqlDateTime } = await import('@stacksjs/database')
const { queryType, queryTypeSql } = await import('../../../storage/framework/defaults/app/Actions/Dashboard/Queries/query-dashboard')
const { QUERY_RANGES, readQueryLogPage } = await import('../../../storage/framework/defaults/app/Actions/Dashboard/Queries/query-list')
type Query = Parameters<typeof readQueryLogPage>[0]

const NOW = Date.UTC(2026, 10, 5, 12)
const NBSP = String.fromCharCode(160)
// Every way a statement's first word can read, including the ones the
// classifier must call OTHER: a longer word, a CTE, an accented letter, and
// leading whitespace SQL does not strip.
const TEXTS = [
  'SELECT * FROM users WHERE id = ?',
  'select id from posts',
  '  \n\tSELECT 1',
  'select(1)',
  'INSERT INTO jobs (queue) VALUES (?)',
  '\r\ninsert into logs values (?)',
  'UPDATE users SET name = ?',
  'Delete from sessions where id = ?',
  'WITH recent AS (SELECT 1) SELECT * FROM recent',
  'PRAGMA table_info(users)',
  'selected_rows()',
  'updates go here',
  `${NBSP}SELECT 1`,
  'S' + String.fromCharCode(233) + 'lect 1',
]
const STATUSES = ['completed', 'completed', 'slow', 'failed'] as const
const CONNECTIONS = ['primary', 'replica', 'analytics'] as const
const COUNT = 160

interface Seed { id: number, query: string, status: string, connection: string, duration: number, at: number }

// One log every 75 minutes back from now, so the hour, the day and the week
// each hold a different number, and some fall outside the week.
const seeds: Seed[] = Array.from({ length: COUNT }, (_, index) => {
  const id = index + 1
  return {
    id,
    query: TEXTS[id % TEXTS.length]!,
    status: STATUSES[id % STATUSES.length]!,
    connection: CONNECTIONS[id % CONNECTIONS.length]!,
    duration: (id * 37) % 250,
    at: NOW - (COUNT - id) * 75 * 60_000 - (id % 7) * 1000,
  }
})

const base: Query = { range: 'day', status: 'all', type: 'all', connection: '', page: 1, perPage: 10 }

function matching(query: Query): Seed[] {
  const start = NOW - QUERY_RANGES[query.range] * 3_600_000
  return seeds
    .filter(seed => seed.at >= start
      && (query.status === 'all' || seed.status === query.status)
      && (query.type === 'all' || queryType(seed.query) === query.type)
      && (!query.connection || seed.connection === query.connection))
    .sort((a, b) => b.at - a.at || b.id - a.id)
}

async function check(label: string, query: Query, expectedPage = query.page): Promise<number> {
  const result = await readQueryLogPage(query, NOW)
  const all = matching(query)
  const page = Math.min(query.page, Math.max(1, Math.ceil(all.length / query.perPage)))
  assert.equal(page, expectedPage, `${dialect} ${label}: page`)
  assert.equal(result.page, page, `${dialect} ${label}: page returned`)
  assert.equal(result.counts.total, all.length, `${dialect} ${label}: total`)
  assert.equal(result.counts.reads, all.filter(seed => queryType(seed.query) === 'SELECT').length, `${dialect} ${label}: reads`)
  assert.equal(result.counts.writes, all.filter(seed => ['INSERT', 'UPDATE', 'DELETE'].includes(queryType(seed.query))).length, `${dialect} ${label}: writes`)
  assert.equal(result.counts.slow, all.filter(seed => seed.status === 'slow').length, `${dialect} ${label}: slow`)
  assert.equal(result.counts.failed, all.filter(seed => seed.status === 'failed').length, `${dialect} ${label}: failed`)
  const average = all.length ? all.reduce((sum, seed) => sum + seed.duration, 0) / all.length : 0
  assert(Math.abs(result.counts.averageDuration - average) < 0.01, `${dialect} ${label}: average ${result.counts.averageDuration} vs ${average}`)
  const inRange = new Set(matching({ ...base, range: query.range }).map(seed => seed.connection))
  assert.deepEqual(result.connections, [...inRange].sort(), `${dialect} ${label}: connections`)
  assert.deepEqual(result.rows.map(row => Number(row.id)), all.slice((page - 1) * query.perPage, page * query.perPage).map(seed => seed.id), `${dialect} ${label}: rows`)
  return all.length
}

try {
  for (const statement of generateSql(plan))
    await db.unsafe(statement).execute()

  for (const seed of seeds) {
    await db.insertInto('query_logs').values({
      id: seed.id,
      query: seed.query,
      normalized_query: seed.query,
      duration: seed.duration,
      connection: seed.connection,
      status: seed.status,
      executed_at: sqlDateTime(new Date(seed.at)),
    } as any).execute()
  }

  // The database must classify every text as the dashboard does, or a type
  // filter or the Reads and Writes cards would disagree with the badges.
  const kinds = await db.unsafe(`SELECT id, query, ${queryTypeSql(dialect)} AS kind FROM query_logs ORDER BY id`).execute() as Array<{ id: unknown, query: string, kind: string }>
  assert.equal(kinds.length, COUNT)
  for (const row of kinds)
    assert.equal(row.kind, queryType(row.query), `${dialect}: ${JSON.stringify(row.query)} is classified alike`)
  assert.deepEqual([...new Set(TEXTS.map(queryType))].sort(), ['DELETE', 'INSERT', 'OTHER', 'SELECT', 'UPDATE'])

  // The seed must reach each case, or a check below passes on nothing.
  const hour = await check('the last hour', { ...base, range: 'hour' })
  const day = await check('the last day', base)
  const week = await check('the last week', { ...base, range: 'week' })
  assert(hour > 0 && hour < day && day < week && week < COUNT, `${dialect}: ranges ${hour} < ${day} < ${week} < ${COUNT}`)

  for (const range of ['day', 'week'] as const) {
    for (const status of ['all', 'slow', 'failed'] as const) {
      for (const type of ['all', 'SELECT', 'INSERT', 'OTHER'] as const) {
        for (const connection of ['', 'replica']) {
          const query = { ...base, range, status, type, connection, perPage: 25 }
          await check(`${range} ${status} ${type} ${connection || 'any'}`, query, 1)
        }
      }
    }
  }
  assert(matching({ ...base, range: 'week', status: 'slow', type: 'SELECT', connection: 'replica' }).length > 0)

  await check('a later page', { ...base, range: 'week', page: 3 })
  await check('a page past the end moves back to the last', { ...base, range: 'week', page: 99 }, Math.ceil(week / 10))
  await check('nothing matches', { ...base, connection: 'none' }, 1)

  console.log('query list OK')
}
finally { resetDatabaseConnection() }
