import assert from 'node:assert/strict'

assert.equal(process.env.DB_CONNECTION, 'sqlite')
const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: ':memory:' } }, queryLogging: { enabled: false } } })
// Off while the batch helper is checked on its own, so the writer's background
// prune cannot race it; on for the second half, which is about the writer.
config.database.queryLogging = { ...config.database.queryLogging, enabled: false, excludedQueries: [], analysis: { enabled: false }, retention: 7, pruneFrequency: 24 }
const { sqlDateTime } = await import('../../src/sql-helpers')
const { logQuery, pruneExpiredQueryLogs, queryLogPruneSettled, queryLogRetentionCutoff } = await import('../../src/query-logger')

await db.unsafe(`CREATE TABLE query_logs (
  id INTEGER PRIMARY KEY, query TEXT, normalized_query TEXT, duration REAL,
  connection TEXT, status TEXT, error TEXT, executed_at TEXT, bindings TEXT,
  trace TEXT, model TEXT, method TEXT, file TEXT, line INTEGER, memory_usage REAL
)`).execute()

const daysAgo = (days: number): string => sqlDateTime(new Date(Date.now() - days * 86_400_000))
const insertOld = async (count: number, days: number, tag: string): Promise<void> => {
  for (let index = 0; index < count; index++)
    await db.unsafe('INSERT INTO query_logs (query, executed_at, status) VALUES (?, ?, ?)', [`${tag} ${index}`, daysAgo(days), 'completed']).execute()
}
const count = async (where = '1 = 1'): Promise<number> =>
  Number(((await db.unsafe(`SELECT COUNT(*) AS n FROM query_logs WHERE ${where}`).execute()) as Array<{ n: number }>)[0]!.n)

// A retention of zero keeps everything; anything else is a cutoff.
assert.equal(queryLogRetentionCutoff(0), null)
assert.equal(queryLogRetentionCutoff('7', Date.parse('2026-10-31T00:00:00Z')), sqlDateTime(new Date('2026-10-24T00:00:00Z')))

// Batches: a backlog larger than one batch is drained, and only what expired.
await insertOld(25, 30, 'backlog')
await insertOld(3, 1, 'recent')
assert.equal(await pruneExpiredQueryLogs(daysAgo(7), 10), 25)
assert.equal(await count(`query LIKE 'backlog%'`), 0)
assert.equal(await count(`query LIKE 'recent%'`), 3)

// The writer expires rows on its own: the first flush after it starts prunes.
config.database.queryLogging.enabled = true
await insertOld(12, 30, 'expired')
await Promise.all(Array.from({ length: 3 }, (_, index) => logQuery({ query: { sql: `SELECT ${index} AS fresh` }, queryDurationMillis: 1 })))
await queryLogPruneSettled()
assert.equal(await count(`query LIKE 'expired%'`), 0, 'rows past retention are pruned by the writer')
assert.equal(await count(`query LIKE 'SELECT%'`), 3, 'the rows just written stay')
assert.equal(await count(`query LIKE 'recent%'`), 3, 'rows inside retention stay')

// And not again until pruneFrequency has passed: one DELETE pass per period.
await insertOld(2, 30, 'later')
await logQuery({ query: { sql: 'SELECT 9 AS again' }, queryDurationMillis: 1 })
await queryLogPruneSettled()
assert.equal(await count(`query LIKE 'later%'`), 2)

console.log('query-log-retention-ok')
