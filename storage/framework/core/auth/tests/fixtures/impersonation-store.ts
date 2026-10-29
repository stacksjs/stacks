import assert from 'node:assert/strict'

const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: process.env.DB_CONNECTION, connections: { sqlite: { database: process.env.DB_DATABASE_PATH }, postgres: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD } }, queryLogging: { enabled: false },
} })
const { createDatabaseImpersonationStore, migrateImpersonationTables } = await import('../../src/impersonation-store')
const { createImpersonationService } = await import('../../src/impersonation')
try {
  await migrateImpersonationTables()
  const store = createDatabaseImpersonationStore()
  const service = createImpersonationService(store, {
    async currentActor() { return { userId: 1, sessionId: 'parent-session', impersonating: false } },
    async mayImpersonate() { return true },
  })
  const { credential, session } = await service.start(2, 'Investigate a missing workout')
  assert(await service.resolve(credential, { method: 'GET', path: '/health' }))
  await service.end(credential)
  assert.equal(await service.resolve(credential, { method: 'GET', path: '/health' }), null)
  const events = await db.selectFrom('auth_privileged_audits').select(['event', 'actor_id', 'subject_id']).execute()
  assert.deepEqual(events.map(row => row.event).sort(), ['accessed', 'ended', 'started'])
  assert(events.every(row => Number(row.actor_id) === 1 && Number(row.subject_id) === 2))
  assert.equal(await store.acceptAccess(session.id, { method: 'GET', path: '/health' }, Date.now()), false)
  await db.unsafe('DROP TABLE auth_privileged_audits').execute()
  await assert.rejects(() => service.start(3, 'Investigate a missing workout'))
  const rows = await db.selectFrom('auth_impersonations').select('subject_id').execute()
  assert.deepEqual(rows.map(row => Number(row.subject_id)), [2], 'failed audit rolls back the entire new session')
  console.log('impersonation persistence OK')
}
finally { await resetDatabaseConnection() }
