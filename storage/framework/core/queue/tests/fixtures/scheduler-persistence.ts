import assert from 'node:assert/strict'

assert.equal(process.env.DB_CONNECTION, 'sqlite')
assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: { default: 'sqlite', connections: { sqlite: { database: ':memory:' } } },
})
const { hasUnfinishedRun, loadPersistedLastRun, persistLastRun } = await import('../../src/scheduler-persistence')

try {
  assert.equal(await loadPersistedLastRun('isolated-fixture'), null)
  await persistLastRun('isolated-fixture', new Date(0))
  assert.equal((await loadPersistedLastRun('isolated-fixture'))?.getTime(), 0)
  await persistLastRun('isolated-fixture', new Date(1000))
  assert.equal((await loadPersistedLastRun('isolated-fixture'))?.getTime(), 1000)

  await db.unsafe('DROP TABLE scheduled_job_runs').execute()
  assert.equal(await loadPersistedLastRun('isolated-fixture'), null)
  await assert.doesNotReject(persistLastRun('isolated-fixture', new Date(0)))
  assert.equal(await hasUnfinishedRun('isolated-fixture'), false)
}
finally {
  resetDatabaseConnection()
}
