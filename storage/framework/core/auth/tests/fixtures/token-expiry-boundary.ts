import assert from 'node:assert/strict'
import { setSystemTime } from 'bun:test'
import { basename, dirname } from 'node:path'

const file = process.env.STACKS_TOKEN_EXPIRY_DB
assert(file && basename(dirname(file)).startsWith('stacks-token-expiry-'))
assert.equal(process.env.DB_CONNECTION, 'sqlite')
assert.equal(process.env.DB_DATABASE_PATH, file)
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection, sqlDateTime } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: 'sqlite', connections: { sqlite: { database: file } }, queryLogging: { enabled: false },
} })
const { configureOrm, releaseOrm } = await import('bun-query-builder')
configureOrm({ database: file })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { createToken, findToken, refreshToken, validateRefreshToken } = await import('../../src/tokens')
const { Auth } = await import('../../src/authentication')
const { authCookie, cookieCheck } = await import('../../src/cookie-auth')
const { authMiddleware } = await import('../../src/middleware')
const failures: string[] = []

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, password TEXT, password_changed_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  await db.insertInto('users').values({ id: 1, name: 'Fixture', email: 'expiry@example.invalid', password: 'unused' }).execute()
  await ensureFrameworkAuthTables()
  const boundary = new Date('2030-01-02T03:04:05.000Z')
  setSystemTime(boundary)

  const cases = [
    ...[-1, 0, 1].map(offset => ({ name: `offset ${offset}`, expiry: sqlDateTime(new Date(boundary.getTime() + offset)), valid: offset > 0 })),
    { name: 'non-expiring', expiry: null, valid: true },
    ...['', ' ', 'not-a-date', 'Infinity', 0].map(expiry => ({ name: `malformed ${JSON.stringify(expiry)}`, expiry, valid: false })),
  ]
  for (const mode of ['validate', 'user', 'middleware', 'cookie', 'find', 'refresh-check', 'refresh-exchange'] as const) {
    for (const entry of cases) {
      const refresh = mode === 'refresh-check' || mode === 'refresh-exchange'
      const pair = await createToken(1, 'expiry-fixture', ['*'], { withRefreshToken: refresh })
      if (refresh)
        await db.updateTable('oauth_refresh_tokens').set({ expires_at: entry.expiry }).where('access_token_id', '=', pair.accessToken.id).execute()
      else
        await db.updateTable('oauth_access_tokens').set({ expires_at: entry.expiry }).where('id', '=', pair.accessToken.id).execute()
      Auth.clearState()
      const request = new Request('https://example.invalid/account', {
        headers: { cookie: authCookie(pair.plainTextToken).split(';')[0]! },
      })
      try {
        let valid: boolean
        if (mode === 'validate') valid = await Auth.validateToken(pair.plainTextToken)
        else if (mode === 'user') valid = Boolean(await Auth.getUserFromToken(pair.plainTextToken))
        else if (mode === 'cookie') valid = await cookieCheck(request)
        else if (mode === 'find') valid = Boolean(await findToken(pair.plainTextToken))
        else if (mode === 'refresh-check') valid = await validateRefreshToken(pair.refreshToken!)
        else if (mode === 'refresh-exchange') {
          const before = {
            access: await db.selectFrom('oauth_access_tokens').selectAll().orderBy('id').get(),
            refresh: await db.selectFrom('oauth_refresh_tokens').selectAll().orderBy('id').get(),
          }
          try { await refreshToken(pair.refreshToken!); valid = true }
          catch (error) {
            assert.equal((error as { status: number }).status, 401)
            valid = false
            assert.deepEqual({
              access: await db.selectFrom('oauth_access_tokens').selectAll().orderBy('id').get(),
              refresh: await db.selectFrom('oauth_refresh_tokens').selectAll().orderBy('id').get(),
            }, before, 'rejected rotation must not mutate credentials')
          }
        }
        else {
          try { await authMiddleware(request); valid = true }
          catch (error) {
            assert.equal((error as { statusCode?: number }).statusCode, 401)
            valid = false
          }
        }
        assert.equal(valid, entry.valid, `${mode}: ${entry.name}`)
      }
      catch (error) { failures.push(String(error)) }
    }
  }
  assert.deepEqual(failures, [])
  console.log('token expiration boundaries OK')
}
finally {
  setSystemTime()
  await releaseOrm()
  resetDatabaseConnection()
}
