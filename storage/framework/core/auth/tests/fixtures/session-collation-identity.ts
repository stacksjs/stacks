import assert from 'node:assert/strict'
import { basename, dirname, resolve } from 'node:path'

const file = process.env.DB_DATABASE_PATH
const directory = process.env.STACKS_SESSION_COLLATION_DIRECTORY
assert(file && directory && resolve(dirname(file)) === resolve(directory) && basename(directory).startsWith('stacks_session_'))
assert.equal(process.env.DB_CONNECTION, 'sqlite')
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, closeDatabaseConnection, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: file } }, queryLogging: { enabled: false } } })
const { SessionAuth } = await import('../../src/session-auth')
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, password TEXT, created_at TEXT, updated_at TEXT)').execute()
  await db.insertInto('users').values({ id: 1, name: 'Owned case-sensitive session', email: 'case@owned.invalid' }).execute()
  // Reproduce a legacy case-insensitive key collation on an actual database.
  await db.unsafe('CREATE TABLE sessions (id TEXT PRIMARY KEY COLLATE NOCASE, user_id INTEGER, expires_at TEXT, last_activity INTEGER, ip_address TEXT, user_agent TEXT, payload TEXT)').execute()
  const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
  await ensureFrameworkAuthTables()
  const credential = 'ab'.repeat(32)
  const alias = credential.toUpperCase()
  const expires = sqlDateTime(new Date(Date.now() + 60_000))
  await db.insertInto('sessions').values({ id: credential, user_id: 1, expires_at: expires, last_activity: Math.floor(Date.now() / 1000), payload: '{}' }).execute()
  assert.equal((await db.selectFrom('sessions').where('id', '=', alias).select('id').executeTakeFirst())?.id, credential, 'the fixture must really use a case-insensitive SQL comparison')
  assert.equal(await SessionAuth.check(alias), false)
  assert.equal(await SessionAuth.user(alias), undefined)
  assert.equal(await SessionAuth.refresh(alias, 120_000), false)
  await SessionAuth.logout(alias)
  assert.equal(await SessionAuth.check(credential), true, 'an alias must not revoke the real credential')
  assert.equal((await db.selectFrom('sessions').where('id', '=', credential).select('expires_at').executeTakeFirst())?.expires_at, expires)
  await SessionAuth.logout(credential)
  assert.equal(await SessionAuth.check(credential), false)
  console.log('exact session collation identity OK')
}
finally { await closeDatabaseConnection() }
