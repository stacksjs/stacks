import assert from 'node:assert/strict'

const dialect = process.env.DB_CONNECTION === 'postgres' ? 'postgres' : 'sqlite'
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: { sqlite: { database: process.env.DB_DATABASE_PATH }, postgres: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD } }, queryLogging: { enabled: false } } })
const id = dialect === 'postgres' ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'
await db.unsafe(`CREATE TABLE jobs (id ${id}, queue TEXT, payload TEXT, attempts INTEGER, reserved_at BIGINT, available_at BIGINT, created_at TEXT)`).execute()
const { job } = await import('../../src/job')
try {
  await job('Routed' as never, { index: 1 } as never).dispatch()
  await job('Routed' as never, { index: 2 } as never).onQueue('custom').dispatch()
  await job('Routed' as never, { index: 3 } as never).onQueue('default').dispatch()
  await job('Plain' as never, { index: 4 } as never).dispatch()
  const rows = await db.selectFrom('jobs').select(['queue', 'payload']).orderBy('id', 'asc').execute()
  assert.deepEqual(rows.map(row => row.queue), ['notifications', 'custom', 'default', 'default'], 'by-name dispatch must inherit the declared queue and preserve explicit routing')
  assert.deepEqual(rows.map(row => JSON.parse(String(row.payload)).options?.queue), ['notifications', 'custom', 'default', undefined])
  console.log('declared queue dispatch OK')
}
finally {
  resetDatabaseConnection()
}
