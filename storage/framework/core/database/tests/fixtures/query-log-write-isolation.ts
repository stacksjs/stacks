import assert from 'node:assert/strict'

assert.equal(process.env.DB_CONNECTION, 'sqlite')
assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: ':memory:' } }, queryLogging: { enabled: false } } })
config.database.queryLogging = { ...config.database.queryLogging, enabled: true, excludedQueries: [], analysis: { enabled: false } }
const { logQuery } = await import('../../src/query-logger')

async function writeWhileLogging(): Promise<void> {
  await db.unsafe('DELETE FROM app_writes').execute()
  const logging = Promise.all(Array.from({ length: 200 }, (_, index) => logQuery({ query: { sql: `SELECT ${index} AS fixture_log` }, queryDurationMillis: 1 })))
  const writing = (async () => {
    for (let id = 1; id <= 200; id++)
      await db.unsafe('INSERT INTO app_writes (id) VALUES (?)', [id]).execute()
  })()
  await Promise.all([logging, writing])
  const rows = await db.unsafe('SELECT id FROM app_writes ORDER BY id').execute()
  assert.deepEqual(rows.map(row => row.id), Array.from({ length: 200 }, (_, index) => index + 1), 'A failed diagnostic batch must not undo acknowledged application writes')
}

try {
  await db.unsafe('CREATE TABLE app_writes (id INTEGER PRIMARY KEY)').execute()
  // No query_logs table: telemetry must not affect the application before migration.
  await writeWhileLogging()

  await db.unsafe(`CREATE TABLE query_logs (
    id INTEGER PRIMARY KEY, query TEXT, normalized_query TEXT, duration REAL,
    connection TEXT, status TEXT, error TEXT, executed_at TEXT, bindings TEXT,
    trace TEXT, model TEXT, method TEXT, file TEXT, line INTEGER, memory_usage REAL
  )`).execute()
  await db.unsafe(`CREATE TRIGGER reject_query_log BEFORE INSERT ON query_logs
    WHEN NEW.query = 'SELECT 42 AS fixture_log'
    BEGIN SELECT RAISE(FAIL, 'fixture rejects one diagnostic'); END`).execute()
  await writeWhileLogging()
  const retained = await db.unsafe('SELECT query FROM query_logs').execute()
  const expected = Array.from({ length: 200 }, (_, index) => `SELECT ${index} AS fixture_log`).filter(query => query !== 'SELECT 42 AS fixture_log')
  assert.deepEqual(retained.map(row => row.query).sort(), expected.sort(), 'Retry must preserve every other diagnostic exactly once')

  // A failed logger savepoint must leave the caller in charge of its transaction.
  for (const rollback of [true, false]) {
    const id = rollback ? 999 : 1000
    const goodLogs = [`SELECT 1 AS nested_${id}_log`, `SELECT 2 AS nested_${id}_log`]
    const work = db.transaction(async () => {
      await db.unsafe('INSERT INTO app_writes (id) VALUES (?)', [id]).execute()
      await Promise.all([goodLogs[0]!, 'SELECT 42 AS fixture_log', goodLogs[1]!].map(sql => logQuery({ query: { sql }, queryDurationMillis: 1 })))
      assert.equal((await db.unsafe('SELECT id FROM app_writes WHERE id = ?', [id]).execute()).length, 1)
      const logs = await db.unsafe('SELECT query FROM query_logs WHERE query IN (?, ?) ORDER BY query', goodLogs).execute()
      assert.deepEqual(logs.map(row => row.query), goodLogs, 'Nested retry preserves both good diagnostics exactly once')
      if (rollback) throw new Error('fixture outer rollback')
    })
    if (rollback) await assert.rejects(work, /fixture outer rollback/)
    else await work
    assert.equal((await db.unsafe('SELECT id FROM app_writes WHERE id = ?', [id]).execute()).length, rollback ? 0 : 1)
    assert.equal((await db.unsafe('SELECT id FROM query_logs WHERE query IN (?, ?)', goodLogs).execute()).length, rollback ? 0 : 2)
  }
  console.log('query-log-write-isolation-ok')
}
finally {
  config.database.queryLogging.enabled = false
  resetDatabaseConnection()
}
