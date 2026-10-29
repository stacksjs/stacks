import assert from 'node:assert/strict'

const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: 'sqlite', connections: { sqlite: { database: process.env.DB_DATABASE_PATH } }, queryLogging: { enabled: false },
} })
const { hasRole, hasFreshRole } = await import('../../src/rbac')

try {
  await db.unsafe('CREATE TABLE roles (id INTEGER PRIMARY KEY, name TEXT NOT NULL, guard_name TEXT NOT NULL, description TEXT, created_at TEXT, updated_at TEXT)').execute()
  await db.unsafe('CREATE TABLE user_roles (user_id INTEGER NOT NULL, role_id INTEGER NOT NULL, created_at TEXT)').execute()
  await db.insertInto('roles').values({ id: 1, name: 'platform-admin', guard_name: 'web' }).execute()
  await db.insertInto('user_roles').values({ user_id: 42, role_id: 1 }).execute()
  assert.equal(await hasRole(42, 'platform-admin'), true)
  assert.equal(await hasFreshRole(42, 'platform-admin'), true)
  assert.equal(await hasFreshRole(42, 'platform-admin', 'api'), false)
  await db.deleteFrom('user_roles').where('user_id', '=', 42).execute()
  assert.equal(await hasRole(42, 'platform-admin'), true, 'the normal role cache still holds the previous grant')
  assert.equal(await hasFreshRole(42, 'platform-admin'), false)
  await db.unsafe('DROP TABLE user_roles').execute()
  await assert.rejects(() => hasFreshRole(42, 'platform-admin'))
  console.log('fresh role checks OK')
}
finally {
  await resetDatabaseConnection()
}
