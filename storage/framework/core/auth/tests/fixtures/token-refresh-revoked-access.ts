import assert from 'node:assert/strict'
import { SQL } from 'bun'
import { setSystemTime } from 'bun:test'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_REFRESH_REVOKED_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-refresh-revoked-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_refresh_revoked_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { Auth } = await import('../../src/authentication')
const { createToken, refreshToken, validateRefreshToken } = await import('../../src/tokens')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const now = new Date('2030-01-02T03:04:05.000Z')
const failures: string[] = []
const originalIdle = config.auth.idleTimeout
async function check(name: string, run: () => Promise<void>) {
  try { setSystemTime(now); await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
async function snapshot() {
  return {
    access: await db.primary.selectFrom('oauth_access_tokens').selectAll().orderBy('id').execute(),
    refresh: await db.primary.selectFrom('oauth_refresh_tokens').selectAll().orderBy('id').execute(),
  }
}
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY)').execute()
  await db.insertInto('users').values({ id: 1 }).execute()
  await ensureFrameworkAuthTables()
  for (const mode of ['idle', 'legacy-revocation'] as const) {
    for (const api of ['validate', 'exchange'] as const) {
      await check(`${mode}/${api}: revoked access never issues a replacement`, async () => {
        const pair = await createToken(1, mode, ['read'])
        const bystander = await createToken(1, 'bystander', ['read'])
        if (mode === 'idle') {
          config.auth.idleTimeout = 1000
          setSystemTime(new Date(now.getTime() + 2000))
          assert.equal(await Auth.getUserFromToken(pair.plainTextToken), undefined)
        }
        else await db.updateTable('oauth_access_tokens').set({ revoked: true }).where('id', '=', pair.accessToken.id).execute()
        const before = await snapshot()
        assert.equal(Boolean(before.access.find(row => String(row.id) === String(pair.accessToken.id))?.revoked), true)
        assert.equal(Boolean(before.refresh.find(row => String(row.access_token_id) === String(pair.accessToken.id))?.revoked), false, 'fixture must retain the old live refresh half')
        if (api === 'validate') assert.equal(await validateRefreshToken(pair.refreshToken!), false)
        else await assert.rejects(refreshToken(pair.refreshToken!), /Invalid or expired refresh token/)
        assert.deepEqual(await snapshot(), before, 'rejection must not partially rotate the pair')
        assert.equal(await validateRefreshToken(bystander.refreshToken!), true)
      })
    }
  }
  await check('absolute access expiry alone does not revoke refresh', async () => {
    const pair = await createToken(1, 'expired but not revoked', ['read'], { expiresAt: now })
    assert.equal(await validateRefreshToken(pair.refreshToken!), true)
    const next = await refreshToken(pair.refreshToken!)
    assert(await Auth.validateToken(next.plainTextToken))
    assert.equal(await validateRefreshToken(pair.refreshToken!), false)
  })
  await check('rolling back access revocation restores refresh eligibility', async () => {
    const pair = await createToken(1, 'rollback', ['read'])
    const before = await snapshot()
    await assert.rejects(db.transaction(async () => {
      await db.updateTable('oauth_access_tokens').set({ revoked: true }).where('id', '=', pair.accessToken.id).execute()
      assert.equal(await validateRefreshToken(pair.refreshToken!), false)
      await assert.rejects(refreshToken(pair.refreshToken!), /Invalid or expired refresh token/)
      throw new Error('rollback control')
    }), /rollback control/)
    assert.deepEqual(await snapshot(), before)
    assert.equal(await validateRefreshToken(pair.refreshToken!), true)
  })
  if (dialect !== 'sqlite') {
    await check('exchange rechecks access revocation after waiting on the SQL row lock', async () => {
      const pair = await createToken(1, 'concurrent revocation', ['read'])
      const observer = new SQL({ adapter: dialect, hostname: process.env.DB_HOST,
        port: Number(process.env.DB_PORT), database: process.env.DB_DATABASE,
        username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
        tls: process.env.DB_SSL === 'true' ? 'require' : 'disable' })
      const blocker = await observer.reserve()
      let held = false
      let done = false
      let pending: Promise<unknown> | undefined
      try {
        await blocker.unsafe('BEGIN'); held = true
        await blocker.unsafe(`UPDATE oauth_access_tokens SET revoked = TRUE WHERE id = ${dialect === 'postgres' ? '$1' : '?'}`, [pair.accessToken.id])
        pending = refreshToken(pair.refreshToken!).finally(() => { done = true })
        void pending.catch(() => {})
        let waiting = false
        const deadline = performance.now() + 5000
        while (!done && !waiting && performance.now() < deadline) {
          const rows = await observer.unsafe(dialect === 'postgres'
            ? "SELECT COUNT(*) AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid != pg_backend_pid()"
            : "SELECT COUNT(*) AS count FROM performance_schema.data_locks WHERE OBJECT_SCHEMA = DATABASE() AND LOCK_STATUS = 'WAITING'")
          waiting = Number(rows[0].count) > 0
          if (!waiting) await Bun.sleep(10)
        }
        assert(waiting && !done, 'exchange must encounter the independent uncommitted revocation')
        await blocker.unsafe('COMMIT'); held = false
        await assert.rejects(pending, /Invalid or expired refresh token/)
        assert.equal(await validateRefreshToken(pair.refreshToken!), false)
      }
      finally {
        if (held) await blocker.unsafe('ROLLBACK')
        await pending?.catch(() => {})
        blocker.release()
        await observer.close()
      }
    })
  }
  assert.deepEqual(failures, [])
  console.log('refresh revocation OK')
}
finally { config.auth.idleTimeout = originalIdle; setSystemTime(); await closeDatabaseConnection() }
