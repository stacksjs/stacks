import assert from 'node:assert/strict'
import { Database } from 'bun:sqlite'
import { setSystemTime } from 'bun:test'
import { basename, dirname } from 'node:path'

const file = process.env.STACKS_SESSION_EXPIRY_RACE_DB
assert(file && basename(dirname(file)).startsWith('stacks-session-expiry-race-'))
assert.equal(process.env.DB_CONNECTION, 'sqlite')
assert.equal(process.env.DB_DATABASE_PATH, file)
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, closeDatabaseConnection, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: 'sqlite', connections: { sqlite: { database: file } }, queryLogging: { enabled: false },
} })
const { SessionAuth } = await import('../../src/session-auth')
const { registerPersistentQueryHooks } = await import('@stacksjs/query-builder')
const contender = new Database(file)
const failures: string[] = []

try {
  const now = new Date('2030-01-02T03:04:05.000Z')
  setSystemTime(now)
  await db.unsafe('CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id INTEGER, expires_at TEXT, last_activity INTEGER, ip_address TEXT, user_agent TEXT)').execute()
  for (const method of ['user', 'check', 'refresh'] as const) {
    const id = `renewed-during-${method}`
    await db.insertInto('sessions').values({ id, user_id: 1, expires_at: sqlDateTime(now), last_activity: 0 }).execute()
    let renewed = false
    const unregister = registerPersistentQueryHooks({
      onQueryStart(event) {
        if (event.kind === 'delete' && event.sql.includes('sessions')) {
          // A refresh which began while the session was valid commits between
          // the stale reader's expiry check and its cleanup DELETE.
          renewed = contender.query('UPDATE sessions SET expires_at = ? WHERE id = ?')
            .run(sqlDateTime(new Date(now.getTime() + 60_000)), id).changes === 1
        }
      },
    })
    try {
      assert.equal(Boolean(await SessionAuth[method](id)), false, 'the request that observed expiry must reject')
      assert(renewed, 'the competing renewal must commit before cleanup')
    }
    finally {
      unregister()
    }
    try {
      assert.equal(await SessionAuth.check(id), true, `${method}: stale expiry cleanup deleted a renewed session`)
      assert.equal(await SessionAuth.refresh(id), true, `${method}: renewed session must remain refreshable`)
    }
    catch (error) { failures.push(String(error)) }

    const expiredId = `expired-during-${method}`
    await db.insertInto('sessions').values({ id: expiredId, user_id: 1, expires_at: sqlDateTime(now), last_activity: 0 }).execute()
    assert.equal(Boolean(await SessionAuth[method](expiredId)), false)
    assert.equal(await SessionAuth.check(expiredId), false, 'an unchanged expired session must remain rejected')
    assert.equal(contender.query('SELECT id FROM sessions WHERE id = ?').get(expiredId), null, 'unchanged expired rows must still be cleaned up')
    for (const expiry of [null, 'invalid']) {
      const invalidId = `${method}-expiry-${expiry}`
      await db.insertInto('sessions').values({ id: invalidId, user_id: 1, expires_at: expiry, last_activity: 0 }).execute()
      assert.equal(Boolean(await SessionAuth[method](invalidId)), false)
      assert.equal(contender.query('SELECT id FROM sessions WHERE id = ?').get(invalidId), null, 'invalid expiry must still be cleaned up')
    }
  }
  assert.deepEqual(failures, [])
  console.log('session expiry cleanup races OK')
}
finally {
  setSystemTime()
  contender.close()
  await closeDatabaseConnection()
}
