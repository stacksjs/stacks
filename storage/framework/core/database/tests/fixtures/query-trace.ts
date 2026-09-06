const { config, overridesReady } = await import('@stacksjs/config')
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('../../src/utils')
const { logQuery } = await import('../../src/query-logger')

await overridesReady
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: { default: 'sqlite', connections: { sqlite: { database: ':memory:' } } },
})
config.database.queryLogging = {
  ...config.database.queryLogging,
  enabled: true,
  captureAllTraces: true,
  excludedQueries: [],
  analysis: { ...config.database.queryLogging?.analysis, enabled: false },
}

async function readSite(value: number): Promise<void> {
  await logQuery({ query: { sql: `SELECT ${value}`, parameters: [value] }, queryDurationMillis: value })
}

async function otherSite(value: number): Promise<void> {
  await logQuery({ query: { sql: `SELECT ${value}`, parameters: [value] }, queryDurationMillis: value })
}

try {
  await db.unsafe(`CREATE TABLE query_logs (
    id INTEGER PRIMARY KEY, query TEXT, normalized_query TEXT, duration REAL,
    connection TEXT, status TEXT, error TEXT, executed_at TEXT, bindings TEXT,
    trace TEXT, model TEXT, method TEXT, file TEXT, line INTEGER, memory_usage REAL
  )`).execute()

  const callers = [readSite, readSite, otherSite, readSite]
  for (const [index, caller] of callers.entries()) {
    await caller(index + 1)
    await Bun.sleep(2)
  }

  const records = await db.unsafe('SELECT * FROM query_logs ORDER BY id').execute()
  if (records.length !== 4)
    throw new Error(`Expected four persisted traces, received ${records.length}`)
  for (const [index, record] of records.entries()) {
    if (record.query !== `SELECT ${index + 1}` || record.bindings !== `[${index + 1}]` || record.duration !== index + 1)
      throw new Error('A repeated trace reused query-specific values')
    if (record.method !== (index === 2 ? 'otherSite' : 'readSite'))
      throw new Error(`Wrong caller for query ${index + 1}: ${record.method}`)
    if (!String(record.file).endsWith('/fixtures/query-trace.ts') || !(Number(record.line) > 0))
      throw new Error('Missing caller location')
    if (!(Number(record.memory_usage) > 0) || !record.executed_at || record.status !== 'completed')
      throw new Error('Missing per-query diagnostics')
  }
  if (records[0]?.trace !== records[1]?.trace || records[0]?.trace !== records[3]?.trace || records[0]?.trace === records[2]?.trace)
    throw new Error('Captured traces did not follow the current caller')
  if (records[0]?.executed_at === records[1]?.executed_at)
    throw new Error('A repeated trace reused its execution timestamp')

  // Computed function names really appear in Bun stack traces. Each new
  // secret-shaped name must be sanitized, including a repeated invocation.
  for (const name of [`token_${'test'.repeat(6)}`, 'TEST_ONLY_OPAQUE_VALUE_'.repeat(3)]) {
    const secretSite = {
      [name]: () => {
        const pending = logQuery({ query: { sql: 'SELECT 10' }, queryDurationMillis: 10 })
        // Keep the named frame: Bun eliminates a direct tail call here.
        return pending.finally(() => {})
      },
    }
    for (let repetition = 0; repetition < 2; repetition++)
      await secretSite[name]!()
    const traces = await db.unsafe('SELECT trace FROM query_logs WHERE query = ?', ['SELECT 10']).execute()
    if (traces.length !== 2 || traces.some(row => String(row.trace).includes(name) || !String(row.trace).includes('<redacted>')))
      throw new Error('Secret-shaped caller name was persisted in a stack trace')
    await db.unsafe('DELETE FROM query_logs WHERE query = ?', ['SELECT 10']).execute()
  }
  console.log('query-trace-ok')
}
finally {
  resetDatabaseConnection()
}
