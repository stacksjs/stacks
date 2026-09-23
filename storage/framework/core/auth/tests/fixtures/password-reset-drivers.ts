import assert from 'node:assert/strict'
import { mock, setSystemTime } from 'bun:test'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_RESET_DRIVERS_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-reset-drivers-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_reset_drivers_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady, overrides } = await import('@stacksjs/config')
await overridesReady
overrides.auth = { ...overrides.auth, passwordReset: { expire: 60, throttle: 60 } }
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const sent: unknown[] = []
const realEmail = { ...await import('@stacksjs/email') }
mock.module('@stacksjs/email', () => ({ ...realEmail,
  template: async () => ({ html: '', text: 'synthetic notification' }),
  mail: { sendOrFail: async (message: unknown) => { sent.push(message) } },
}))
const { passwordResets } = await import('../../src/password/reset')
const { makeHash, verifyHash } = await import('@stacksjs/security')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { registerPersistentQueryHooks } = await import('@stacksjs/query-builder')
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try { await run() }
  catch (error) { failures.push(`${name}: ${String(error)}`) }
}
const now = new Date('2030-01-02T03:04:05.000Z')
const previousTimezone = process.env.TZ
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(255) UNIQUE, password TEXT)').execute()
  await ensureFrameworkAuthTables()
  // The auth migrator adds this column even to our minimal users table.
  // Remove it explicitly to exercise the documented unmigrated-schema path.
  await db.unsafe('ALTER TABLE users DROP COLUMN password_changed_at').execute()
  const token = 'synthetic-reset-token'
  const hashedToken = await makeHash(token, { algorithm: 'bcrypt' })
  setSystemTime(now)
  for (const [zone, offsetMinutes] of [['UTC', 0], ['Pacific/Honolulu', 600], ['Asia/Kathmandu', -345]] as const) {
    process.env.TZ = zone
    assert.equal(new Date().getTimezoneOffset(), offsetMinutes)
    for (const legacy of [false, true]) {
      for (const offset of [-60_000, 0, 60_000]) {
        await check(`${zone} ${legacy ? 'created_at' : 'expires_at'} ${offset}`, async () => {
          await db.deleteFrom('password_resets').execute()
          await db.insertInto('password_resets').values({ email: 'reset@example.invalid', token: hashedToken,
            expires_at: legacy ? null : sqlDateTime(new Date(now.getTime() + offset)),
            created_at: sqlDateTime(new Date(now.getTime() - (legacy ? 3_600_000 : 0) + offset)),
          } as never).execute()
          assert.equal(await passwordResets('reset@example.invalid').verifyToken(token), offset > 0)
        })
      }
    }
  }
  process.env.TZ = 'UTC'
  await db.deleteFrom('password_resets').execute()
  await db.insertInto('users').values({ id: 1, email: 'reset@example.invalid', password: 'original' }).execute()
  await db.insertInto('password_resets').values({ email: 'reset@example.invalid', token: hashedToken, expires_at: sqlDateTime(new Date(now.getTime() + 60_000)) } as never).execute()
  await check('one successful password reset', async () => {
    const attempts = await Promise.allSettled(Array.from({ length: 6 }, () => passwordResets('reset@example.invalid').resetPassword(token, 'new-synthetic-password')))
    assert(attempts.every(result => result.status === 'fulfilled'), Bun.inspect(attempts))
    assert.equal(attempts.filter(result => result.status === 'fulfilled' && result.value.success).length, 1)
    assert.equal((await passwordResets('reset@example.invalid').resetPassword(token, 'another-password')).success, false)
    const user = await db.primary.selectFrom('users').where('id', '=', 1).selectAll().executeTakeFirstOrThrow()
    assert(await verifyHash('new-synthetic-password', String(user.password)))
    assert.equal(sent.length, 1, 'only the winning reset sends a stubbed notification')
  })
  async function seed() {
    setSystemTime(now)
    await db.deleteFrom('password_resets').execute()
    await db.updateTable('users').set({ password: 'original' }).where('id', '=', 1).execute()
    await db.insertInto('password_resets').values({ email: 'reset@example.invalid', token: hashedToken,
      expires_at: sqlDateTime(new Date(now.getTime() + 60_000)),
    } as never).execute()
    sent.length = 0
  }
  async function assertUnchanged() {
    assert.equal((await db.primary.selectFrom('users').where('id', '=', 1).selectAll().executeTakeFirstOrThrow()).password, 'original')
    assert.equal((await db.primary.selectFrom('password_resets').where('email', '=', 'reset@example.invalid').selectAll().executeTakeFirstOrThrow()).token, hashedToken)
    assert.equal(sent.length, 0)
  }
  await check('incorrect token preserves the valid reset and password', async () => {
    await seed()
    assert.equal((await passwordResets('reset@example.invalid').resetPassword('incorrect-token', 'unused-password')).success, false)
    await assertUnchanged()
  })
  for (const [operation, table] of [['UPDATE', 'users'], ['DELETE', 'password_resets']] as const) {
    await check(`${operation} failure rolls back reset and password`, async () => {
      await seed()
      if (dialect === 'postgres') {
        await db.unsafe("CREATE FUNCTION reject_reset() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic reset failure'; END; $$").execute()
        await db.unsafe(`CREATE TRIGGER reject_reset BEFORE ${operation} ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_reset()`).execute()
      }
      else if (dialect === 'mysql')
        await db.unsafe(`CREATE TRIGGER reject_reset BEFORE ${operation} ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic reset failure'`).execute()
      else
        await db.unsafe(`CREATE TRIGGER reject_reset BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT, 'synthetic reset failure'); END`).execute()
      try {
        await assert.rejects(() => passwordResets('reset@example.invalid').resetPassword(token, 'unused-password'))
        await assertUnchanged()
      }
      finally {
        await db.unsafe(`DROP TRIGGER reject_reset${dialect === 'postgres' ? ` ON ${table}` : ''}`).execute()
        if (dialect === 'postgres') await db.unsafe('DROP FUNCTION reject_reset()').execute()
      }
    })
  }
  if (dialect !== 'mysql') {
    for (const [operation, table] of [['UPDATE', 'users'], ['DELETE', 'password_resets']] as const) {
      await check(`${operation} silently suppressed does not report success`, async () => {
        await seed()
        if (dialect === 'postgres') {
          await db.unsafe('CREATE FUNCTION ignore_reset() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$').execute()
          await db.unsafe(`CREATE TRIGGER ignore_reset BEFORE ${operation} ON ${table} FOR EACH ROW EXECUTE FUNCTION ignore_reset()`).execute()
        }
        else await db.unsafe(`CREATE TRIGGER ignore_reset BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(IGNORE); END`).execute()
        try {
          await assert.rejects(() => passwordResets('reset@example.invalid').resetPassword(token, 'unused-password'))
          await assertUnchanged()
        }
        finally {
          await db.unsafe(`DROP TRIGGER ignore_reset${dialect === 'postgres' ? ` ON ${table}` : ''}`).execute()
          if (dialect === 'postgres') await db.unsafe('DROP FUNCTION ignore_reset()').execute()
        }
      })
    }
  }
  await check('deadline crossing while acquiring the owner is rejected', async () => {
    await seed()
    let crossed = false
    const stop = registerPersistentQueryHooks({ onQueryStart(event) {
      if (event.kind === 'select' && /\busers\b/.test(event.sql)) {
        setSystemTime(new Date(now.getTime() + 60_000))
        crossed = true
      }
    } })
    try {
      assert.equal((await passwordResets('reset@example.invalid').resetPassword(token, 'unused-password')).success, false)
      assert(crossed)
      await assertUnchanged()
    }
    finally { stop(); setSystemTime(now) }
  })
  await check('modern schemas stamp UTC and legacy schemas already succeeded', async () => {
    await db.unsafe('ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP NULL').execute()
    // SELECT * prepared plans from the legacy-schema phase cannot be reused
    // after changing its result shape on Postgres. Start a fresh fixture pool.
    await closeDatabaseConnection()
    await seed()
    process.env.TZ = 'Pacific/Honolulu'
    assert.equal((await passwordResets('reset@example.invalid').resetPassword(token, 'new-stamped-password')).success, true)
    const user = await db.primary.selectFrom('users').where('id', '=', 1).selectAll().executeTakeFirstOrThrow()
    const stamp = user.password_changed_at
    assert.equal(stamp instanceof Date ? sqlDateTime(stamp) : stamp, sqlDateTime(now))
  })
  process.env.TZ = 'UTC'
  await check('outer reset without optional sessions table commits its password', async () => {
    await seed()
    await db.transaction(async () => {
      assert.equal((await passwordResets('reset@example.invalid').resetPassword(token, 'nested-without-sessions')).success, true)
      // A caught missing-table error must not poison this outer transaction.
      await db.primary.selectFrom('users').where('id', '=', 1).selectAll().executeTakeFirstOrThrow()
    })
    const user = await db.primary.selectFrom('users').where('id', '=', 1).selectAll().executeTakeFirstOrThrow()
    assert(await verifyHash('nested-without-sessions', String(user.password)))
    assert.equal(await db.primary.selectFrom('password_resets').where('email', '=', 'reset@example.invalid').selectAll().executeTakeFirst(), undefined)
    assert.equal(sent.length, 1)
  })
  await db.unsafe('CREATE TABLE sessions (id VARCHAR(255) PRIMARY KEY, user_id INTEGER, expires_at TIMESTAMP NULL)').execute()
  await check('outer rollback discards password-change notification', async () => {
    await seed()
    await db.insertInto('sessions').values({ id: 'synthetic-session', user_id: 1, expires_at: sqlDateTime(new Date(now.getTime() + 60_000)) } as never).execute()
    await assert.rejects(() => db.transaction(async () => {
      assert.equal((await passwordResets('reset@example.invalid').resetPassword(token, 'nested-password')).success, true)
      await Promise.resolve()
      throw new Error('synthetic outer rollback')
    }), /synthetic outer rollback/)
    await assertUnchanged()
    assert(await db.primary.selectFrom('sessions').where('id', '=', 'synthetic-session').selectAll().executeTakeFirst())
  })
  await check('notification waits for the outer commit', async () => {
    await seed()
    await db.transaction(async () => {
      assert.equal((await passwordResets('reset@example.invalid').resetPassword(token, 'nested-committed-password')).success, true)
      await Promise.resolve()
      assert.equal(sent.length, 0, 'a savepoint release is not the outer commit')
    })
    assert.equal(sent.length, 1)
  })
  assert.deepEqual(failures, [])
  console.log('password reset drivers OK')
}
finally {
  setSystemTime()
  if (previousTimezone === undefined) delete process.env.TZ
  else process.env.TZ = previousTimezone
  mock.module('@stacksjs/email', () => realEmail)
  await closeDatabaseConnection()
}
