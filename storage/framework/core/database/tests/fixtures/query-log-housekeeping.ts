import assert from 'node:assert/strict'

assert.equal(process.env.DB_CONNECTION, 'sqlite')
const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: ':memory:' } }, queryLogging: { enabled: false } } })
config.database.queryLogging = { ...config.database.queryLogging, enabled: true, excludedQueries: [], analysis: { enabled: false }, retention: 0, pruneFrequency: 24, slowThreshold: 100 }
const { logQuery, queryLogPruneSettled } = await import('../../src/query-logger')

await db.unsafe(`CREATE TABLE query_logs (
  id INTEGER PRIMARY KEY, query TEXT, normalized_query TEXT, duration REAL,
  connection TEXT, status TEXT, error TEXT, executed_at TEXT, bindings TEXT,
  trace TEXT, model TEXT, method TEXT, file TEXT, line INTEGER, memory_usage REAL
)`).execute()

const stored = async (): Promise<string[]> => {
  await queryLogPruneSettled()
  const rows = await db.unsafe('SELECT query, status FROM query_logs ORDER BY id').execute() as Array<{ query: string, status: string }>
  return rows.map(row => `${row.status}: ${row.query}`)
}

const POLL = 'SELECT * FROM jobs WHERE queue = $1 AND reserved_at IS NULL AND available_at <= $2 ORDER BY id ASC LIMIT 1'
const REAP = 'UPDATE "jobs" SET "reserved_at" = $1, "available_at" = $2 WHERE "reserved_at" <= $3'
const HEARTBEAT = 'INSERT INTO queue_workers ("worker_id", "snapshot", "heartbeat_at") VALUES ($1, $2, $3) ON CONFLICT ("worker_id") DO UPDATE SET "snapshot" = excluded."snapshot"'

// A worker's polls, reaping and heartbeats are not the application's queries.
for (const sql of [POLL, REAP, HEARTBEAT, 'SELECT state FROM queue_circuit_state WHERE queue = $1'])
  await logQuery({ query: { sql }, queryDurationMillis: 1 })
// The application's own are, including ones that only look similar.
await logQuery({ query: { sql: 'SELECT * FROM user_jobs WHERE id = $1' }, queryDurationMillis: 1 })
await logQuery({ query: { sql: 'SELECT * FROM posts WHERE title = \'jobs\'' }, queryDurationMillis: 1 })
assert.deepEqual(await stored(), [
  'completed: SELECT * FROM user_jobs WHERE id = $1',
  'completed: SELECT * FROM posts WHERE title = \'jobs\'',
])

// A poll that is slow or fails is the one worth reading, so it is kept.
await logQuery({ query: { sql: POLL }, queryDurationMillis: 250 })
await logQuery({ query: { sql: REAP }, queryDurationMillis: 1, error: new Error('database is locked') })
assert.deepEqual((await stored()).slice(2), [`slow: ${POLL}`, `failed: ${REAP}`])

// And every one of them is recorded for an app that asks.
config.database.queryLogging.logHousekeeping = true
await logQuery({ query: { sql: POLL }, queryDurationMillis: 1 })
assert.deepEqual((await stored()).slice(4), [`completed: ${POLL}`])

console.log('query-log-housekeeping-ok')
