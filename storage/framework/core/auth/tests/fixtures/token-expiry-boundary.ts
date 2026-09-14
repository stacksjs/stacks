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
const { createToken, findToken } = await import('../../src/tokens')
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

  for (const mode of ['validate', 'user', 'middleware', 'cookie', 'find'] as const) {
    for (const offset of [-1, 0, 1, null]) {
      const pair = await createToken(1, 'expiry-fixture', ['*'], { withRefreshToken: false })
      const expiry = offset === null ? null : sqlDateTime(new Date(boundary.getTime() + offset))
      await db.updateTable('oauth_access_tokens').set({ expires_at: expiry }).where('id', '=', pair.accessToken.id).execute()
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
        else {
          try { await authMiddleware(request); valid = true }
          catch (error) {
            assert.equal((error as { statusCode?: number }).statusCode, 401)
            valid = false
          }
        }
        assert.equal(valid, offset === null || offset > 0, `${mode}: expiry offset ${offset}`)
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
