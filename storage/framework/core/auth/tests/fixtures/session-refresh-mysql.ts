import assert from 'node:assert/strict'
import { setSystemTime } from 'bun:test'

const { DB_HOST: host, DB_DATABASE: name, DB_USERNAME: username, DB_PASSWORD: password, DB_PORT: port } = process.env
assert.equal(process.env.DB_CONNECTION, 'mysql')
assert(name?.startsWith('stacks_session_test_'))
assert(host && ['localhost', '127.0.0.1', '[::1]'].includes(host))
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection, sqlDateTime } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: { default: 'mysql', connections: { mysql: { name, host, port: Number(port || 3306), username, password } } },
})
const { sessionRefresh } = await import('../../src/session-auth')

try {
  setSystemTime(new Date('2030-01-02T03:04:05.000Z'))
  await db.unsafe('CREATE TABLE sessions (id VARCHAR(255) PRIMARY KEY, expires_at DATETIME, last_activity BIGINT, ip_address TEXT, user_agent TEXT)').execute()
  await db.insertInto('sessions').values({ id: 'mysql-refresh', expires_at: sqlDateTime(new Date(Date.now() + 60_000)), last_activity: 0 }).execute()
  assert.equal(await sessionRefresh('mysql-refresh', 120_000), true, 'first refresh must renew the session')
  assert.equal(await sessionRefresh('mysql-refresh', 120_000), true, 'same-value refresh must remain successful')
  setSystemTime(new Date('2030-01-02T03:04:05.123Z'))
  assert.equal(await sessionRefresh('mysql-refresh', 120_000), true, 'refresh must tolerate DATETIME second precision')
  assert.equal(await sessionRefresh('mysql-refresh', 120_000), true, 'same-value refresh must remain successful at subsecond instants')
  assert.equal(await sessionRefresh('missing-session'), false)
  console.log('PASS MySQL initial, same-value and missing-session refresh')
}
finally {
  setSystemTime()
  resetDatabaseConnection()
}
