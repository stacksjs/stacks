import assert from 'node:assert/strict'

assert.equal(process.env.DB_CONNECTION, 'sqlite')
assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: ':memory:' } }, queryLogging: { enabled: false } } })
config.database.queryLogging = { ...config.database.queryLogging, enabled: true, excludedQueries: [], analysis: { enabled: false } }
const { logQuery } = await import('../../src/query-logger')

// Count every statement that writes query_logs, whichever path the batch takes.
let inserts = 0
const counted = (sql: unknown): void => {
  if (/insert\s+into\s+"?query_logs/i.test(String(sql)))
    inserts++
}
// The driver sees every statement, including ones that fail to prepare.
const { Database } = await import('bun:sqlite')
for (const method of ['prepare', 'query', 'run', 'exec'] as const) {
  const original = Database.prototype[method] as (...args: unknown[]) => unknown
  Database.prototype[method] = function (this: unknown, sql: unknown, ...rest: unknown[]) {
    counted(sql)
    return original.call(this, sql, ...rest)
  } as never
}

const logMany = (count: number, tag: string): Promise<void[]> =>
  Promise.all(Array.from({ length: count }, (_, index) => logQuery({ query: { sql: `SELECT ${index} AS ${tag}` }, queryDurationMillis: 1 })))

// Before migration: the first batch finds the table missing, and nothing
// after it tries to write - no per-record retry, no INSERT per later batch.
await logMany(150, 'before_a')
await logMany(150, 'before_b')
assert.equal(inserts, 1, `A missing query_logs table is written to once, not ${inserts} times`)

// After migration the next batch probes the catalog, finds it, and logs again.
await db.unsafe(`CREATE TABLE query_logs (
  id INTEGER PRIMARY KEY, query TEXT, normalized_query TEXT, duration REAL,
  connection TEXT, status TEXT, error TEXT, executed_at TEXT, bindings TEXT,
  trace TEXT, model TEXT, method TEXT, file TEXT, line INTEGER, memory_usage REAL
)`).execute()
await logMany(3, 'after')
const rows = await db.unsafe('SELECT query FROM query_logs ORDER BY query').execute() as Array<{ query: string }>
assert.deepEqual(rows.map(row => row.query), ['SELECT 0 AS after', 'SELECT 1 AS after', 'SELECT 2 AS after'])
console.log('query-log-missing-table-ok')
