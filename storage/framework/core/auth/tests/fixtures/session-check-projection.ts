import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const file = process.env.STACKS_SESSION_PROJECTION_DB
assert(file && basename(dirname(file)).startsWith('stacks-session-projection-'))
assert.equal(process.env.DB_CONNECTION, 'sqlite')
assert.equal(process.env.DB_DATABASE_PATH, file)
const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
if (config.database.queryLogging) config.database.queryLogging.enabled = false
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, closeDatabaseConnection, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: 'sqlite', connections: { sqlite: { database: file } }, queryLogging: { enabled: false },
} })
const { SessionAuth } = await import('../../src/session-auth')
const { registerPersistentQueryHooks } = await import('@stacksjs/query-builder')

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY)').execute()
  await db.insertInto('users').values({ id: 1 }).execute()
  await db.unsafe('CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id INTEGER, expires_at TEXT, last_activity INTEGER, ip_address TEXT, user_agent TEXT, payload TEXT)').execute()
  await db.insertInto('sessions').values({
    id: 'projected-session', user_id: 1, expires_at: sqlDateTime(new Date(Date.now() + 60_000)),
    last_activity: 0, payload: 'x'.repeat(256_000),
  }).execute()

  const sessionReads: string[] = []
  const unregister = registerPersistentQueryHooks({
    onQueryStart(event) {
      if (event.kind === 'select' && /\bfrom\s+["`]?sessions["`]?\b/i.test(event.sql))
        sessionReads.push(event.sql)
    },
  })
  try {
    assert.equal(await SessionAuth.check('projected-session'), true)
    config.auth.session = { ...config.auth.session, enforceFingerprint: true }
    assert.equal(await SessionAuth.check('projected-session'), true)
  }
  finally { unregister() }

  assert.equal(sessionReads.length, 2)
  for (const sql of sessionReads) {
    assert(!/\bselect\s+\*/i.test(sql), 'session check must select only the columns it uses')
    assert(!/\bpayload\b/i.test(sql), 'session check must not transfer the arbitrary session payload')
  }
  console.log('session check projection OK')
}
finally { await closeDatabaseConnection() }
