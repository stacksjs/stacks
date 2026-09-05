const { config, overridesReady } = await import('@stacksjs/config')
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('../../src/utils')

await overridesReady
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: { default: 'sqlite', connections: { sqlite: { database: ':memory:' } } },
})
const persistence = process.argv[2] === 'true'
config.database.queryLogging = {
  ...config.database.queryLogging,
  enabled: persistence,
  excludedQueries: [],
  analysis: { ...config.database.queryLogging?.analysis, enabled: false },
}

async function createLogTable(): Promise<void> {
  await db.unsafe(`CREATE TABLE IF NOT EXISTS query_logs (
    id INTEGER PRIMARY KEY, query TEXT, normalized_query TEXT, duration REAL,
    connection TEXT, status TEXT, error TEXT, executed_at TEXT, bindings TEXT,
    trace TEXT, model TEXT, method TEXT, file TEXT, line INTEGER, memory_usage REAL
  )`).execute()
}

const trackerKey = Symbol.for('stacks.database.queryTracker')
const globals = globalThis as Record<symbol, unknown>

async function queryWithDiagnostics(marker: string, fail = false): Promise<void> {
  if (!fail) {
    await db.unsafe('CREATE TABLE IF NOT EXISTS query_logger_fixture (id INTEGER PRIMARY KEY)').execute()
    await db.unsafe('INSERT OR IGNORE INTO query_logger_fixture (id) VALUES (1)').execute()
  }
  let timer: ReturnType<typeof setTimeout>
  const tracked = new Promise<void>((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Missing query diagnostics for ${marker}`)), 2000)
    globals[trackerKey] = (query: string) => {
      if (query.includes(marker)) resolve()
    }
  })

  try {
    let failed = false
    try {
      const rows = await db.selectFrom(fail ? marker : 'query_logger_fixture').select([`id as ${marker}`]).execute()
      if (rows[0]?.[marker] !== 1)
        throw new Error('Unexpected query result')
    }
    catch (error) {
      if (!fail) throw error
      failed = true
    }
    if (failed !== fail)
      throw new Error('Query did not fail as expected')
    await tracked
    // Let the deferred INSERT and its own diagnostic callbacks settle.
    await Bun.sleep(0)
    if (persistence) {
      const records = await db.unsafe('SELECT query, status FROM query_logs').execute()
      const matching = records.filter(row => String(row.query).includes(marker))
      if (matching.length !== 1 || matching[0]?.status !== (fail ? 'failed' : 'completed'))
        throw new Error(`Unexpected persisted diagnostics for ${marker}`)
      if (records.some(row => /insert\s+into/i.test(String(row.query))))
        throw new Error('Query logging recursively persisted its own INSERT')
    }
  }
  finally {
    clearTimeout(timer!)
  }
}

try {
  await createLogTable()
  await queryWithDiagnostics('query_logger_cold')
  await queryWithDiagnostics('query_logger_warm')
  resetDatabaseConnection()
  await createLogTable()
  await queryWithDiagnostics('query_logger_reset')
  await queryWithDiagnostics('query_logger_missing_table', true)
  await queryWithDiagnostics('query_logger_after_error')
  if (persistence) {
    // The logger is fully loaded here. A process-wide recursion guard can
    // drop every other real query while its preceding log INSERT is pending.
    for (const mode of ['sequential', 'concurrent']) {
      const marker = `query_logger_burst_${mode}`
      const query = () => db.selectFrom('query_logger_fixture').select([`id as ${marker}`]).execute()
      if (mode === 'sequential') {
        for (let i = 0; i < 200; i++) await query()
      }
      else {
        await Promise.all(Array.from({ length: 200 }, query))
      }
      await Bun.sleep(0)
      const records = await db.unsafe('SELECT query FROM query_logs').execute()
      const matching = records.filter(row => String(row.query).includes(marker))
      if (matching.length !== 200)
        throw new Error(`Lost ${mode} query logs: expected 200, received ${matching.length}`)
      if (records.some(row => /insert\s+into/i.test(String(row.query))))
        throw new Error('Query logging recursively persisted its own INSERT')
    }

    await db.unsafe('DROP TABLE query_logs').execute()
    await db.selectFrom('query_logger_fixture').select(['id']).execute()
    await Bun.sleep(0)
    await createLogTable()
    await queryWithDiagnostics('query_logger_after_failed_store')

    const { logQuery } = await import('../../src/query-logger')
    const literalQuery = "SELECT 42 AS total, 'Ada 123' AS name, TRUE AS active, NULL AS missing FROM query_logger_fixture"
    await logQuery({ query: { sql: literalQuery }, queryDurationMillis: 1 })
    const normalized = await db.unsafe('SELECT normalized_query FROM query_logs WHERE query = ?', [literalQuery]).execute()
    if (normalized.length !== 1 || normalized[0]?.normalized_query !== 'SELECT ? AS total, ? AS name, ? AS active, ? AS missing FROM query_logger_fixture')
      throw new Error('Persisted query normalization changed')
  }
  console.log('query-logger-dispatch-ok')
}
finally {
  delete globals[trackerKey]
  resetDatabaseConnection()
}
