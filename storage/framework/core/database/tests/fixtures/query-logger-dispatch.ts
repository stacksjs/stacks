const { config, overridesReady } = await import('@stacksjs/config')
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('../../src/utils')
const { registerPersistentQueryHooks } = await import('@stacksjs/query-builder')

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
    trace TEXT, model TEXT, method TEXT, file TEXT, line INTEGER, memory_usage REAL,
    affected_tables TEXT, tags TEXT
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
    // Let the bounded background batch window and its callbacks settle.
    await Bun.sleep(10)
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
    let queryLogInsertStatements = 0
    const stopCountingLogInserts = registerPersistentQueryHooks({
      onQueryEnd(event) {
        if (/insert\s+into\s+[`"]?query_logs/i.test(event.sql))
          queryLogInsertStatements++
      },
    })
    // The logger is fully loaded here. A process-wide recursion guard can
    // drop every other real query while its preceding log INSERT is pending.
    try {
      for (const mode of ['sequential', 'concurrent']) {
        if (mode === 'concurrent') queryLogInsertStatements = 0
        const marker = `query_logger_burst_${mode}`
        const query = () => db.selectFrom('query_logger_fixture').select([`id as ${marker}`]).execute()
        if (mode === 'sequential') {
          for (let i = 0; i < 200; i++) await query()
        }
        else {
          await Promise.all(Array.from({ length: 200 }, query))
        }
        await Bun.sleep(10)
        const records = await db.unsafe('SELECT query FROM query_logs').execute()
        const matching = records.filter(row => String(row.query).includes(marker))
        if (matching.length !== 200)
          throw new Error(`Lost ${mode} query logs: expected 200, received ${matching.length}`)
        if (records.some(row => /insert\s+into/i.test(String(row.query))))
          throw new Error('Query logging recursively persisted its own INSERT')
        if (mode === 'concurrent' && queryLogInsertStatements >= matching.length)
          throw new Error(`Concurrent query logs were not batched: ${queryLogInsertStatements} INSERTs for ${matching.length} rows`)
      }
    }
    finally {
      stopCountingLogInserts()
    }

    await db.unsafe('DROP TABLE query_logs').execute()
    await db.selectFrom('query_logger_fixture').select(['id']).execute()
    await Bun.sleep(10)
    await createLogTable()
    await queryWithDiagnostics('query_logger_after_failed_store')

    const { logQuery } = await import('../../src/query-logger')
    // RAISE(FAIL) retains rows inserted before the rejected row in a single
    // statement. Retrying a partially applied batch must not duplicate them.
    await db.unsafe(`CREATE TRIGGER reject_query_log BEFORE INSERT ON query_logs
      WHEN NEW.query = 'SELECT 1 AS rejected_log_row'
      BEGIN SELECT RAISE(FAIL, 'rejected query log'); END`).execute()
    const failureSql = ['SELECT 1 AS before_rejected_log', 'SELECT 1 AS rejected_log_row', 'SELECT 1 AS after_rejected_log']
    try {
      await Promise.all(failureSql.map(sql => logQuery({ query: { sql }, queryDurationMillis: 1 })))
      const retained = await db.unsafe('SELECT query FROM query_logs WHERE query IN (?, ?, ?) ORDER BY query', failureSql).execute()
      if (JSON.stringify(retained.map(row => row.query)) !== JSON.stringify([failureSql[2], failureSql[0]]))
        throw new Error('A rejected query log duplicated or discarded unrelated diagnostics')
    }
    finally {
      await db.unsafe('DROP TRIGGER reject_query_log').execute()
    }

    const literalQuery = " \tSELECT  42 AS total,\n 'Ada 123' AS name, TRUE AS active, NULL AS missing FROM query_logger_fixture"
    await logQuery({ query: { sql: literalQuery }, queryDurationMillis: 1 })
    const normalized = await db.unsafe('SELECT normalized_query FROM query_logs WHERE query = ?', [literalQuery]).execute()
    if (normalized.length !== 1 || normalized[0]?.normalized_query !== 'SELECT ? AS total, ? AS name, ? AS active, ? AS missing FROM query_logger_fixture')
      throw new Error('Persisted query normalization changed')

    config.database.queryLogging = {
      ...config.database.queryLogging,
      slowThreshold: 100,
      analysis: { enabled: true, analyzeAll: false, explainPlan: false, suggestions: false },
    }
    // Concurrent logs can have different columns. Their order must not decide
    // whether a slow query keeps its analysis or an ordinary query gains it.
    for (const slowFirst of [false, true]) {
      const ordinarySql = `SELECT 1 AS mixed_ordinary_${Number(slowFirst)} FROM query_logger_fixture`
      const analyzedSql = `SELECT 2 AS mixed_analyzed_${Number(slowFirst)} FROM query_logger_fixture`
      const events = [
        { query: { sql: ordinarySql }, queryDurationMillis: 1 },
        { query: { sql: analyzedSql }, queryDurationMillis: 101 },
      ]
      await Promise.all((slowFirst ? events.reverse() : events).map(logQuery))
      const records = await db.unsafe('SELECT query, status, affected_tables, tags FROM query_logs WHERE query IN (?, ?)', [ordinarySql, analyzedSql]).execute()
      const ordinary = records.find(row => row.query === ordinarySql)
      const analyzed = records.find(row => row.query === analyzedSql)
      if (records.length !== 2 || ordinary?.status !== 'completed' || ordinary.affected_tables !== null || ordinary.tags !== null)
        throw new Error('Concurrent ordinary query diagnostics changed')
      if (analyzed?.status !== 'slow' || analyzed.affected_tables !== '["query_logger_fixture"]' || analyzed.tags !== '["SELECT","table:query_logger_fixture"]')
        throw new Error('Concurrent slow query analysis was lost')
    }
  }
  console.log('query-logger-dispatch-ok')
}
finally {
  delete globals[trackerKey]
  resetDatabaseConnection()
}
