import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const file = process.env.STACKS_SESSION_IDLE_DB
assert(file && basename(dirname(file)).startsWith('stacks-session-idle-'))
assert.equal(process.env.DB_CONNECTION, 'sqlite')
assert.equal(process.env.DB_DATABASE_PATH, file)

const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
const originalIdle = config.auth.idleTimeout
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, closeDatabaseConnection, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: 'sqlite', connections: { sqlite: { database: file } }, queryLogging: { enabled: false },
} })

const { SessionAuth } = await import('../../src/session-auth')

try {
  config.auth.idleTimeout = 60_000
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, password TEXT, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  await db.insertInto('users').values({ id: 1, name: 'Session fixture', email: 'session@example.invalid', password: 'unused' }).execute()
  await db.unsafe('CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id INTEGER, expires_at TEXT, last_activity INTEGER, ip_address TEXT, user_agent TEXT, payload TEXT)').execute()

  const now = Date.now()
  const expires = sqlDateTime(new Date(now + 60 * 60 * 1000))
  await db.insertInto('sessions').values({ id: 'fresh-check', user_id: 1, expires_at: expires, last_activity: Math.floor((now - 30_000) / 1000) }).execute()
  assert.equal(await SessionAuth.check('fresh-check'), true)
  const fresh = await db.selectFrom('sessions').where('id', '=', 'fresh-check').select('last_activity').executeTakeFirstOrThrow()
  assert(Number(fresh.last_activity) >= Math.floor(now / 1000))

  await db.insertInto('sessions').values({ id: 'stale-check', user_id: 1, expires_at: expires, last_activity: Math.floor((now - 60_001) / 1000) }).execute()
  assert.equal(await SessionAuth.check('stale-check'), false)
  assert.equal(await db.selectFrom('sessions').where('id', '=', 'stale-check').select('id').executeTakeFirst(), undefined)

  await db.insertInto('sessions').values({ id: 'stale-user', user_id: 1, expires_at: expires, last_activity: Math.floor((now - 60_001) / 1000) }).execute()
  assert.equal((await SessionAuth.user('stale-user'))?.id, undefined)
  assert.equal(await db.selectFrom('sessions').where('id', '=', 'stale-user').select('id').executeTakeFirst(), undefined)

  await db.insertInto('sessions').values({ id: 'stale-refresh', user_id: 1, expires_at: expires, last_activity: Math.floor((now - 60_001) / 1000) }).execute()
  assert.equal(await SessionAuth.refresh('stale-refresh'), false)
  assert.equal(await db.selectFrom('sessions').where('id', '=', 'stale-refresh').select('id').executeTakeFirst(), undefined)

  console.log('session idle timeout OK')
}
finally {
  config.auth.idleTimeout = originalIdle
  await closeDatabaseConnection()
}
