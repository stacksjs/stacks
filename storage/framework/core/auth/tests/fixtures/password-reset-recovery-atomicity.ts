import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_RESET_RECOVERY_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-reset-recovery-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_reset_recovery_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
let sent = 0
mock.module('@stacksjs/email', () => ({
  template: async () => ({ text: 'synthetic recovery notification' }),
  mail: { sendOrFail: async () => { sent++ } },
}))
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { configureOrm, releaseOrm } = await import('bun-query-builder')
if (dialect === 'sqlite') configureOrm({ database: process.env.DB_DATABASE_PATH })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { passwordResets } = await import('../../src/password/reset')
const { createToken, findToken, validateRefreshToken } = await import('../../src/tokens')
const { sessionCheck } = await import('../../src/session-auth')
const { makeHash, verifyHash } = await import('@stacksjs/security')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const token = 'synthetic-recovery-token'
const tokenHash = await makeHash(token, { algorithm: 'bcrypt' })
const oldPasswordHash = await makeHash('synthetic-old-password', { algorithm: 'bcrypt' })
const email = 'synthetic@example.invalid'
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(255), password TEXT)').execute()
  await ensureFrameworkAuthTables()
  await db.unsafe('CREATE TABLE sessions (id VARCHAR(255) PRIMARY KEY, user_id INTEGER, last_activity INTEGER, expires_at TIMESTAMP)').execute()
  // Run schema variants in independent processes: changing SELECT * result
  // columns after preparing queries invalidates PostgreSQL's cached plans.
  const stamped = process.env.STACKS_RESET_RECOVERY_SCHEMA === 'stamped'
  assert(stamped || process.env.STACKS_RESET_RECOVERY_SCHEMA === 'legacy')
  if (!stamped) await db.unsafe('ALTER TABLE users DROP COLUMN password_changed_at').execute()
  for (const table of ['oauth_access_tokens', 'oauth_refresh_tokens', 'sessions']) {
    await check(`${stamped ? 'stamped' : 'legacy'} recovery preserves credentials if ${table} revocation fails`, async () => {
      sent = 0
      await db.deleteFrom('password_resets').execute()
      await db.deleteFrom('sessions').execute()
      await db.deleteFrom('oauth_refresh_tokens').execute()
      await db.deleteFrom('oauth_access_tokens').execute()
      await db.deleteFrom('users').execute()
      await db.insertInto('users').values({ id: 42, email, password: oldPasswordHash }).execute()
      await db.insertInto('password_resets').values({ email, token: tokenHash, expires_at: sqlDateTime(new Date(Date.now() + 60_000)) }).execute()
      await db.insertInto('sessions').values({ id: 'synthetic-session', user_id: 42, last_activity: Math.floor(Date.now() / 1000), expires_at: sqlDateTime(new Date(Date.now() + 60_000)) }).execute()
      const pair = await createToken(42, 'old session', ['read'])
      const operation = table === 'sessions' ? 'DELETE' : 'UPDATE'
      if (dialect === 'postgres') {
        await db.unsafe("CREATE FUNCTION reject_recovery() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture recovery revocation denied'; END; $$").execute()
        await db.unsafe(`CREATE TRIGGER reject_recovery BEFORE ${operation} ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_recovery()`).execute()
      }
      else if (dialect === 'mysql')
        await db.unsafe(`CREATE TRIGGER reject_recovery BEFORE ${operation} ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture recovery revocation denied'`).execute()
      else
        await db.unsafe(`CREATE TRIGGER reject_recovery BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT, 'fixture recovery revocation denied'); END`).execute()
      try {
        await assert.rejects(passwordResets(email).resetPassword(token, 'synthetic-new-password'), /fixture recovery revocation denied/)
        assert.equal((await db.primary.selectFrom('users').where('id', '=', 42).selectAll().executeTakeFirstOrThrow()).password === oldPasswordHash, true, 'failed recovery preserves the old password')
        assert.equal((await db.primary.selectFrom('password_resets').where('email', '=', email).selectAll().executeTakeFirstOrThrow()).token, tokenHash)
        assert(Boolean(await findToken(pair.plainTextToken)))
        assert.equal(await validateRefreshToken(pair.refreshToken!), true)
        assert.equal(await sessionCheck('synthetic-session'), true)
        assert.equal(sent, 0)
      }
      finally {
        await db.unsafe(`DROP TRIGGER reject_recovery${dialect === 'postgres' ? ` ON ${table}` : ''}`).execute()
        if (dialect === 'postgres') await db.unsafe('DROP FUNCTION reject_recovery()').execute()
      }
      assert.equal((await passwordResets(email).resetPassword(token, 'synthetic-new-password')).success, true)
      assert.equal(await findToken(pair.plainTextToken), null)
      assert.equal(await validateRefreshToken(pair.refreshToken!), false)
      assert.equal(await sessionCheck('synthetic-session'), false)
      const row = await db.primary.selectFrom('users').where('id', '=', 42).selectAll().executeTakeFirstOrThrow()
      assert(await verifyHash('synthetic-new-password', String(row.password)))
      assert.equal(sent, 1)
    })
  }
  assert.deepEqual(failures, [])
  console.log('password recovery atomicity OK')
}
finally {
  releaseOrm()
  await closeDatabaseConnection()
}
