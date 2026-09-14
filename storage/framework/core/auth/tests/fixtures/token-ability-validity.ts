import assert from 'node:assert/strict'
import { setSystemTime } from 'bun:test'
import { basename, dirname } from 'node:path'

const file = process.env.STACKS_TOKEN_ABILITIES_DB
assert(file && basename(dirname(file)).startsWith('stacks-token-abilities-'))
assert.equal(process.env.DB_CONNECTION, 'sqlite')
assert.equal(process.env.DB_DATABASE_PATH, file)
const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
if (config.database.queryLogging) config.database.queryLogging.enabled = false
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection, sqlDateTime, parseSqlDateTime } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: 'sqlite', connections: { sqlite: { database: file } }, queryLogging: { enabled: false },
} })
const { configureOrm, releaseOrm } = await import('bun-query-builder')
configureOrm({ database: file })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { createToken } = await import('../../src/tokens')
const { Auth } = await import('../../src/authentication')
const { authCookie } = await import('../../src/cookie-auth')
const { enhanceRequest } = await import('@stacksjs/router')
const { runWithRequest, setAmbientRequestContext } = await import('../../../router/src/request-context')
setAmbientRequestContext(true)
const failures: string[] = []
const idleTimeout = config.auth.idleTimeout

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, password TEXT, password_changed_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  await db.insertInto('users').values({ id: 1, name: 'Fixture', email: 'abilities@example.invalid', password: 'unused' }).execute()
  await ensureFrameworkAuthTables()
  const now = new Date('2030-01-02T03:04:05.000Z')
  setSystemTime(now)
  config.auth.idleTimeout = 60_000

  for (const mode of ['live', 'wildcard', 'non-expiring', 'revoked', 'expired', 'boundary', 'password', 'idle'] as const) {
    for (const transport of ['bearer', 'cookie'] as const) {
      for (const userFirst of [false, true]) {
        const name = `${mode}/${transport}/userFirst=${userFirst}`
        await db.updateTable('users').set({ password_changed_at: null }).where('id', '=', 1).execute()
        const scopes = mode === 'wildcard' ? ['*'] : ['posts:read']
        const pair = await createToken(1, name, scopes, { withRefreshToken: false })
        await db.updateTable('oauth_access_tokens').set({ updated_at: sqlDateTime(new Date(now.getTime() - 30_000)) }).where('id', '=', pair.accessToken.id).execute()
        if (mode === 'revoked')
          await db.updateTable('oauth_access_tokens').set({ revoked: true }).where('id', '=', pair.accessToken.id).execute()
        if (mode === 'expired' || mode === 'boundary' || mode === 'non-expiring')
          await db.updateTable('oauth_access_tokens').set({ expires_at: mode === 'non-expiring' ? null : sqlDateTime(new Date(now.getTime() - (mode === 'expired' ? 1000 : 0))) }).where('id', '=', pair.accessToken.id).execute()
        if (mode === 'password') {
          await db.updateTable('oauth_access_tokens').set({ created_at: sqlDateTime(new Date(now.getTime() - 2000)) }).where('id', '=', pair.accessToken.id).execute()
          await db.updateTable('users').set({ password_changed_at: sqlDateTime(new Date(now.getTime() - 1000)) }).where('id', '=', 1).execute()
        }
        if (mode === 'idle')
          await db.updateTable('oauth_access_tokens').set({ updated_at: sqlDateTime(new Date(now.getTime() - 60_001)) }).where('id', '=', pair.accessToken.id).execute()

        const req = enhanceRequest(new Request('https://abilities.invalid/account', { headers: transport === 'bearer'
          ? { authorization: `Bearer ${pair.plainTextToken}` }
          : { cookie: authCookie(pair.plainTextToken).split(';')[0]! } }))
        const valid = ['live', 'wildcard', 'non-expiring'].includes(mode)
        const before = await db.selectFrom('oauth_access_tokens').where('id', '=', pair.accessToken.id).selectAll().executeTakeFirst()
        try {
          await runWithRequest(req, async () => {
            if (userFirst)
              assert.equal(Boolean(await Auth.getUserFromToken(pair.plainTextToken)), valid, `${name}: user`)
            assert.equal(await Auth.tokenCan('posts:read'), valid, `${name}: tokenCan`)
            assert.equal(await Auth.tokenCant('posts:read'), !valid, `${name}: tokenCant`)
            assert.equal(await Auth.tokenCanAll(['posts:read']), valid, `${name}: tokenCanAll`)
            assert.equal(await Auth.tokenCanAny(['posts:read', 'admin']), valid, `${name}: tokenCanAny`)
            assert.deepEqual(await Auth.tokenAbilities(), valid ? scopes : [], `${name}: abilities`)
            assert.equal(Boolean(await Auth.currentAccessToken()), valid, `${name}: current token`)
            assert.equal(await Auth.tokenCan('admin'), mode === 'wildcard', `${name}: unrelated ability`)
          })
          if (!userFirst) {
            const after = await db.selectFrom('oauth_access_tokens').where('id', '=', pair.accessToken.id).selectAll().executeTakeFirst()
            assert.deepEqual(after, before, `${name}: ability reads must not mutate credentials`)
          }
          // The ID-based management API is deliberately not an authorization check.
          if (mode === 'revoked')
            assert.equal((await Auth.findToken(Number(pair.accessToken.id)))?.revoked, true)
        }
        catch (error) { failures.push(`${name}: ${error}`) }
      }
    }
  }

  await db.updateTable('users').set({ password_changed_at: null }).where('id', '=', 1).execute()
  const active = await createToken(1, 'active-session', ['posts:read'], { withRefreshToken: false })
  for (const elapsed of [45_000, 90_000]) {
    setSystemTime(new Date(now.getTime() + elapsed))
    const req = enhanceRequest(new Request('https://abilities.invalid/account', { headers: { authorization: `Bearer ${active.plainTextToken}` } }))
    await runWithRequest(req, async () => {
      assert(await Auth.getUserFromToken(active.plainTextToken), 'Active sessions refresh their idle deadline')
      const token = await Auth.currentAccessToken()
      assert.equal(token?.createdAt.getTime(), now.getTime(), 'Cached creation time remains the original UTC mint time')
      assert.equal(token?.updatedAt.getTime(), now.getTime() + elapsed, 'Cached last-seen follows successful authentication')
    })
    const row = await db.selectFrom('oauth_access_tokens').where('id', '=', active.accessToken.id).select('updated_at').executeTakeFirst()
    assert.equal(parseSqlDateTime(row?.updated_at)?.getTime(), now.getTime() + elapsed, 'Last-seen is durable across requests')
  }
  assert.deepEqual(failures, [])
  console.log('token ability validity OK')
}
finally {
  config.auth.idleTimeout = idleTimeout
  setSystemTime()
  await releaseOrm()
  resetDatabaseConnection()
}
