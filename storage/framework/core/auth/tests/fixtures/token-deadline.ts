import assert from 'node:assert/strict'
import { setSystemTime } from 'bun:test'
import { basename, dirname } from 'node:path'

const file = process.env.STACKS_TOKEN_DEADLINE_DB
assert(file && basename(dirname(file)).startsWith('stacks-token-deadline-'))
const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
if (dialect === 'sqlite') assert.equal(process.env.DB_DATABASE_PATH, file)
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_token_deadline_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection, sqlDateTime, parseSqlDateTime } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: file } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { configureOrm, releaseOrm } = await import('bun-query-builder')
if (dialect === 'sqlite') configureOrm({ database: file })
const { User, ormReady } = await import('@stacksjs/orm')
await ormReady
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { createToken, findToken, refreshToken } = await import('../../src/tokens')
const { Auth } = await import('../../src/authentication')
const failures: string[] = []
const storedDeadline = (value: number) => dialect === 'mysql' ? Math.floor(value / 1000) * 1000 : value
const check = async (name: string, run: () => Promise<void>) => {
  try { await run() }
  catch (error) { failures.push(`${name}: ${String(error)}`) }
}

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, password TEXT, password_changed_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  await db.insertInto('users').values({ id: 1, name: 'Fixture', email: 'deadline@example.invalid', password: 'unused' }).execute()
  await ensureFrameworkAuthTables()
  const user = await User.find(1)
  assert(user)
  const now = new Date('2030-01-02T03:04:05.800Z')
  setSystemTime(now)

  for (const offset of [30_123, 90_500, 0, -1000]) {
    await check(`explicit expiry ${offset}`, async () => {
      const deadline = new Date(now.getTime() + offset)
      const result = await Auth.createTokenForUser(user, { expiresAt: deadline, expiresInMinutes: 60, withRefreshToken: false })
      const row = await db.selectFrom('oauth_access_tokens').selectAll().where('id', '=', result.accessToken.id).executeTakeFirstOrThrow()
      setSystemTime(deadline)
      assert.equal(await Auth.validateToken(result.plainTextToken), false, 'deadline must not be extended')
      setSystemTime(now)
      assert.equal(parseSqlDateTime(row.expires_at)?.getTime(), storedDeadline(deadline.getTime()), 'stored deadline must never round up')
      assert.equal(result.accessToken.expiresAt?.getTime(), storedDeadline(deadline.getTime()), 'returned deadline must match storage')
      assert.equal(result.expiresIn, Math.max(0, Math.floor((storedDeadline(deadline.getTime()) - now.getTime()) / 1000)), 'reported remaining seconds')
    })
    setSystemTime(now)
  }

  for (const minutes of [0, 0.5, 1.5, 60]) {
    for (const mode of ['Auth', 'raw', 'refresh'] as const) {
      await check(`${mode} duration ${minutes}`, async () => {
        const result = mode === 'Auth'
          ? await Auth.createTokenForUser(user, { expiresInMinutes: minutes, withRefreshToken: false })
          : mode === 'raw'
            ? await createToken(1, 'deadline', ['read'], { expiresInMinutes: minutes, withRefreshToken: false })
            : await refreshToken((await createToken(1)).refreshToken!, { expiresInMinutes: minutes })
        const row = await db.selectFrom('oauth_access_tokens').selectAll().where('id', '=', result.accessToken.id).executeTakeFirstOrThrow()
        const expected = storedDeadline(now.getTime() + minutes * 60_000)
        assert.equal(parseSqlDateTime(row.expires_at)?.getTime(), expected)
        assert.equal(result.accessToken.expiresAt?.getTime(), expected)
        assert.equal(result.expiresIn, Math.max(0, Math.floor((expected - now.getTime()) / 1000)))
        setSystemTime(new Date(now.getTime() + minutes * 60_000))
        assert.equal(await findToken(result.plainTextToken), null, 'the advertised deadline must not leave a usable token')
        setSystemTime(now)
      })
      setSystemTime(now)
    }
  }

  // A duration is elapsed time, including when the local clock repeats an hour.
  for (const mode of ['Auth', 'raw', 'refresh'] as const) {
    await check(`${mode} crosses daylight saving fallback`, async () => {
      const start = new Date('2030-11-03T08:59:30.000Z')
      setSystemTime(start)
      const result = mode === 'Auth'
        ? await Auth.createTokenForUser(user, { expiresInMinutes: 2, withRefreshToken: false })
        : mode === 'raw'
          ? await createToken(1, 'deadline', ['read'], { expiresInMinutes: 2, withRefreshToken: false })
          : await refreshToken((await createToken(1)).refreshToken!, { expiresInMinutes: 2 })
      const row = await db.selectFrom('oauth_access_tokens').selectAll().where('id', '=', result.accessToken.id).executeTakeFirstOrThrow()
      assert.equal(parseSqlDateTime(row.expires_at)?.getTime(), start.getTime() + 120_000)
      assert.equal(result.expiresIn, 120)
    })
  }
  setSystemTime(now)

  await check('rotation retains the existing deadline', async () => {
    const original = await createToken(1, 'rotate', ['read'], { withRefreshToken: false })
    const deadline = new Date(storedDeadline(now.getTime() + 30_123))
    await db.updateTable('oauth_access_tokens').set({ expires_at: sqlDateTime(deadline) }).where('id', '=', original.accessToken.id).execute()
    const replacement = await Auth.rotateToken(original.plainTextToken)
    assert(replacement)
    assert.equal(await findToken(original.plainTextToken), null)
    const found = await findToken(replacement)
    assert.equal(found?.expiresAt?.getTime(), deadline.getTime())
    assert.deepEqual(found?.scopes, ['read'])
    setSystemTime(deadline)
    assert.equal(await findToken(replacement), null)
  })

  assert.deepEqual(failures, [])
  console.log('token deadlines OK')
}
finally {
  setSystemTime()
  await releaseOrm()
  resetDatabaseConnection()
}
