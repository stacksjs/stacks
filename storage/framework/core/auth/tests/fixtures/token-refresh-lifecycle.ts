import assert from 'node:assert/strict'
import { SQL } from 'bun'
import { setSystemTime } from 'bun:test'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_REFRESH_LIFECYCLE_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-refresh-lifecycle-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_refresh_lifecycle_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection, withRoutingContext, contextHasWritten, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { configureOrm, releaseOrm } = await import('bun-query-builder')
if (dialect === 'sqlite') configureOrm({ database: process.env.DB_DATABASE_PATH! })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { Auth } = await import('../../src/authentication')
const { createToken, refreshToken, validateRefreshToken, revokeToken, deleteExpiredTokens } = await import('../../src/tokens')
const { authCookie, userFromCookie } = await import('../../src/cookie-auth')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { enhanceRequest } = await import('@stacksjs/router')
const { runWithRequest, setAmbientRequestContext } = await import('../../../router/src/request-context')
setAmbientRequestContext(true)
const now = new Date('2030-01-02T03:04:05.000Z')
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try { setSystemTime(now); await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, password TEXT, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  await db.insertInto('users').values({ id: 1, name: 'Synthetic', email: 'refresh@example.invalid' }).execute()
  await ensureFrameworkAuthTables()
  for (const mode of ['validate', 'user', 'request', 'cookie', 'concurrent'] as const) {
    await check(`${mode}: expiry rejects access without deleting its longer-lived grant`, async () => {
      const pair = await createToken(1, mode, ['read'], { expiresAt: new Date(now.getTime() + 1000), refreshExpiresInDays: 1 })
      const other = await createToken(1, 'bystander', ['read'])
      const before = await db.primary.selectFrom('oauth_access_tokens').where('id', '=', pair.accessToken.id).selectAll().executeTakeFirst()
      setSystemTime(new Date(now.getTime() + 1000))
      let wrote = false
      await withRoutingContext(async () => {
        if (mode === 'validate') assert.equal(await Auth.validateToken(pair.plainTextToken), false)
        if (mode === 'user') assert.equal(await Auth.getUserFromToken(pair.plainTextToken), undefined)
        if (mode === 'request') {
          const request = enhanceRequest(new Request('http://localhost/account', { headers: { authorization: `Bearer ${pair.plainTextToken}` } }))
          await runWithRequest(request, async () => { assert.equal(await Auth.user(), undefined) })
        }
        if (mode === 'cookie') {
          const request = new Request('http://localhost/account', { headers: { cookie: authCookie(pair.plainTextToken).split(';')[0]! } })
          assert.equal(await userFromCookie(request), undefined)
        }
        if (mode === 'concurrent') assert.deepEqual(await Promise.all(Array.from({ length: 8 }, () => Auth.validateToken(pair.plainTextToken))), Array(8).fill(false))
        wrote = contextHasWritten()
      })
      assert.equal(await validateRefreshToken(pair.refreshToken!), true, 'access rejection must not revoke the still-live refresh grant')
      assert.deepEqual(await db.primary.selectFrom('oauth_access_tokens').where('id', '=', pair.accessToken.id).selectAll().executeTakeFirst(), before)
      assert.equal(wrote, false, 'expired access checks must be read-only')
      const rotated = await refreshToken(pair.refreshToken!)
      assert(await Auth.validateToken(rotated.plainTextToken))
      assert.equal(await validateRefreshToken(pair.refreshToken!), false, 'rotation stays single-use')
      assert.equal(await validateRefreshToken(other.refreshToken!), true)
    })
  }
  await check('explicit revocation still kills refresh after access expiry', async () => {
    const pair = await createToken(1, 'revoked', ['read'], { expiresAt: new Date(now.getTime() + 1000) })
    setSystemTime(new Date(now.getTime() + 1000))
    await revokeToken(pair.plainTextToken)
    assert.equal(await Auth.validateToken(pair.plainTextToken), false)
    assert.equal(await validateRefreshToken(pair.refreshToken!), false)
    await assert.rejects(refreshToken(pair.refreshToken!))
  })
  for (const [name, prune] of [['standalone', deleteExpiredTokens], ['Auth', () => Auth.pruneExpiredTokens()]] as const) {
    await check(`${name} cleanup preserves live refresh grants while deleting exhausted access rows`, async () => {
      await db.deleteFrom('oauth_refresh_tokens').execute()
      await db.deleteFrom('oauth_access_tokens').execute()
      const refreshable = await createToken(1, 'refreshable', ['read'], { expiresAt: new Date(now.getTime() - 1000) })
      const exhausted = await createToken(1, 'exhausted', ['read'], { expiresAt: new Date(now.getTime() - 1000), refreshExpiresInDays: -1 })
      await createToken(1, 'access only', ['read'], { expiresAt: new Date(now.getTime() - 1000), withRefreshToken: false })
      const live = await createToken(1, 'live', ['read'])
      assert.equal(await prune(), 2, 'only the two exhausted access rows are prunable')
      assert.equal(await validateRefreshToken(refreshable.refreshToken!), true, 'cleanup must preserve the independent refresh lifetime')
      assert.equal(await validateRefreshToken(exhausted.refreshToken!), false)
      assert.equal(await validateRefreshToken(live.refreshToken!), true)
      const replacement = await refreshToken(refreshable.refreshToken!)
      assert(await Auth.validateToken(replacement.plainTextToken))
      assert.equal(await validateRefreshToken(refreshable.refreshToken!), false)
    })
  }
  await check('cleanup does not lock a retained live refresh grant', async () => {
    await db.deleteFrom('oauth_refresh_tokens').execute()
    await db.deleteFrom('oauth_access_tokens').execute()
    const retained = await createToken(1, 'retained', ['read'], { expiresAt: new Date(now.getTime() - 1000) })
    await createToken(1, 'prunable', ['read'], { expiresAt: new Date(now.getTime() - 1000), withRefreshToken: false })
    if (dialect !== 'mysql') assert.equal(await deleteExpiredTokens(), 1)
    else {
      const observer = new SQL({ adapter: 'mysql', hostname: process.env.DB_HOST,
        port: Number(process.env.DB_PORT), database: process.env.DB_DATABASE,
        username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
        tls: process.env.DB_SSL === 'true' ? 'require' : 'disable' })
      const blocker = await observer.reserve()
      let held = false
      let done = false
      let pending: Promise<number> | undefined
      try {
        await blocker.unsafe('BEGIN'); held = true
        await blocker.unsafe('SELECT id FROM oauth_access_tokens WHERE id = ? FOR UPDATE', [retained.accessToken.id])
        pending = deleteExpiredTokens().finally(() => { done = true })
        void pending.catch(() => {})
        const deadline = performance.now() + 5000
        while (!done && performance.now() < deadline) {
          const waiting = await observer.unsafe("SELECT COUNT(*) AS count FROM performance_schema.data_locks WHERE OBJECT_SCHEMA = DATABASE() AND LOCK_STATUS = 'WAITING'")
          assert.equal(Number(waiting[0].count), 0, 'cleanup must not wait on a retained refreshable row')
          await Bun.sleep(10)
        }
        assert(done, 'cleanup must finish before the retained row is released')
        assert.equal(await pending, 1)
      }
      finally {
        if (held) await blocker.unsafe('ROLLBACK')
        await pending?.catch(() => {})
        blocker.release()
        await observer.close()
      }
    }
    assert.equal(await validateRefreshToken(retained.refreshToken!), true)
  })
  await check('concurrent multi-page cleanup counts each exhausted pair once', async () => {
    await db.deleteFrom('oauth_refresh_tokens').execute()
    await db.deleteFrom('oauth_access_tokens').execute()
    const retained = await createToken(1, 'non-expiring refresh', ['read'], { expiresAt: new Date(now.getTime() - 1000) })
    await db.updateTable('oauth_refresh_tokens').set({ expires_at: null }).where('access_token_id', '=', retained.accessToken.id).execute()
    const client = await db.primary.selectFrom('oauth_access_tokens').where('id', '=', retained.accessToken.id).selectAll().executeTakeFirstOrThrow()
    // More than two pages, with a retained row before and after the candidates.
    for (let start = 0; start < 1003; start += 50) {
      await db.insertInto('oauth_access_tokens').values(Array.from({ length: Math.min(50, 1003 - start) }, (_, offset) => ({
        tokenable_type: 'users', tokenable_id: 1, user_id: 1, oauth_client_id: client.oauth_client_id,
        token: `synthetic-expired-${start + offset}`, revoked: false,
        expires_at: sqlDateTime(now),
      }))).execute()
    }
    const live = await createToken(1, 'live after pages', ['read'])
    const counts = await Promise.all([deleteExpiredTokens(), Auth.pruneExpiredTokens()])
    assert.equal(counts.reduce((total, count) => total + count, 0), 1003)
    assert.equal(await deleteExpiredTokens(), 0)
    const survivors = await db.primary.selectFrom('oauth_access_tokens').selectAll().orderBy('id').execute()
    assert.deepEqual(survivors.map(row => String(row.id)), [retained.accessToken.id, live.accessToken.id].map(String))
    assert.equal(await validateRefreshToken(retained.refreshToken!), true)
    assert.equal(await validateRefreshToken(live.refreshToken!), true)
  })
  assert.deepEqual(failures, [])
  console.log('refresh lifecycle OK')
}
finally { setSystemTime(); await releaseOrm(); await closeDatabaseConnection() }
