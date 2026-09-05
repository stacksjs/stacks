const file = process.argv[2]!
const { config, overridesReady } = await import('@stacksjs/config')
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('../../../storage/framework/core/database/src/utils')

await overridesReady
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: { default: 'sqlite', connections: { sqlite: { database: file } } },
})
config.database.queryLogging = {
  ...config.database.queryLogging,
  enabled: true,
  excludedQueries: [],
  analysis: { ...config.database.queryLogging?.analysis, enabled: false },
}

try {
  const rows = await db.selectFrom('bench_items').select(['id', 'name']).where('id', '=', 1).limit(1).execute()
  if (JSON.stringify(rows) !== '[{"id":1,"name":"item-1"}]')
    throw new Error('Unexpected benchmark query result')

  const deadline = Date.now() + 2000
  for (;;) {
    const records = await db.unsafe('SELECT query, status FROM query_logs').execute()
    if (records.length > 0) {
      if (records.length !== 1 || !String(records[0]?.query).includes('bench_items') || records[0]?.status !== 'completed')
        throw new Error('Unexpected benchmark query log')
      break
    }
    if (Date.now() > deadline)
      throw new Error('Benchmark query was never logged')
    await Bun.sleep(10)
  }
  console.log('fixture-query-logging-ok')
}
finally {
  resetDatabaseConnection()
}
