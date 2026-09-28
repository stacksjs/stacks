import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_PASSWORD_REHASH_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-password-rehash-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_password_rehash_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}

const { overridesReady, hashing } = await import('@stacksjs/config')
await overridesReady
hashing.driver = 'bcrypt'
hashing.bcrypt = { rounds: 5 }
hashing.rehashOnLogin = true

const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: {
    default: dialect,
    connections: dialect === 'sqlite'
      ? { sqlite: { database: process.env.DB_DATABASE_PATH } }
      : { [dialect]: {
          name: process.env.DB_DATABASE,
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
        } },
    queryLogging: { enabled: false },
  },
})
const { configureOrm, releaseOrm } = await import('bun-query-builder')
if (dialect === 'sqlite') configureOrm({ database: process.env.DB_DATABASE_PATH! })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { Auth } = await import('../../src/authentication')
const { SessionAuth } = await import('../../src/session-auth')
const { flushPasswordRehashes } = await import('../../src/password-rehash')
const { RateLimiter } = await import('../../src/rate-limiter')
const { info, makeHash, verifyHash } = await import('@stacksjs/security')

const password = 'synthetic-login-password'
const staleHash = await makeHash(password, { algorithm: 'bcrypt', rounds: 4 })
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try { await run() }
  catch (error) { failures.push(`${name}: ${String(error)}`) }
}
async function insertUser(id: number, email: string) {
  await db.insertInto('users').values({ id, name: 'Fixture', email, password: staleHash }).execute()
  await RateLimiter.resetAttempts(email)
}
async function storedHash(id: number): Promise<string> {
  const row = await db.primary.selectFrom('users').where('id', '=', id).select('password').executeTakeFirstOrThrow()
  return String(row.password)
}

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email VARCHAR(255), password TEXT, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  await db.unsafe('CREATE TABLE sessions (id VARCHAR(255) PRIMARY KEY, user_id INTEGER, payload TEXT, expires_at TIMESTAMP, last_activity INTEGER, ip_address TEXT, user_agent TEXT)').execute()

  await check('bearer credentials upgrade once', async () => {
    const email = 'bearer-rehash@example.invalid'
    await insertUser(1, email)
    assert.equal(await Auth.withVerifiedCredentials({ email, password }, async () => true), true)
    await flushPasswordRehashes()
    const first = await storedHash(1)
    assert.equal(info(first).options.rounds, 5)
    assert.notEqual(first, staleHash)
    assert(await verifyHash(password, first))

    assert.equal(await Auth.withVerifiedCredentials({ email, password }, async () => true), true)
    await flushPasswordRehashes()
    assert.equal(await storedHash(1), first, 'a current hash must not be rewritten')
  })

  await check('failed verification never rewrites', async () => {
    const email = 'failed-rehash@example.invalid'
    await insertUser(2, email)
    assert.equal(await Auth.withVerifiedCredentials({ email, password: 'wrong-password' }, async () => true), null)
    await flushPasswordRehashes()
    assert.equal(await storedHash(2), staleHash)
  })

  await check('session login upgrades after persistence', async () => {
    const email = 'session-rehash@example.invalid'
    await insertUser(3, email)
    const session = await SessionAuth.login(email, password)
    await flushPasswordRehashes()
    assert(await SessionAuth.check(session.sessionId))
    assert.equal(info(await storedHash(3)).options.rounds, 5)
  })

  await check('rehash write failure does not fail login', async () => {
    const email = 'write-failure@example.invalid'
    await insertUser(4, email)
    if (dialect === 'postgres') {
      await db.unsafe(`CREATE FUNCTION reject_password_rehash() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id = 4 THEN RAISE EXCEPTION 'fixture rehash denied'; END IF; RETURN NEW; END; $$`).execute()
      await db.unsafe('CREATE TRIGGER reject_password_rehash BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION reject_password_rehash()').execute()
    }
    else if (dialect === 'mysql') {
      await db.unsafe(`CREATE TRIGGER reject_password_rehash BEFORE UPDATE ON users FOR EACH ROW BEGIN IF OLD.id = 4 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture rehash denied'; END IF; END`).execute()
    }
    else {
      await db.unsafe(`CREATE TRIGGER reject_password_rehash BEFORE UPDATE ON users WHEN OLD.id = 4 BEGIN SELECT RAISE(FAIL, 'fixture rehash denied'); END`).execute()
    }

    assert.equal(await Auth.withVerifiedCredentials({ email, password }, async () => true), true)
    await flushPasswordRehashes()
    assert.equal(await storedHash(4), staleHash)
  })

  await check('outer rollback discards the queued rehash', async () => {
    const email = 'rollback-rehash@example.invalid'
    await insertUser(5, email)
    await assert.rejects(db.transaction(async () => {
      assert.equal(await Auth.withVerifiedCredentials({ email, password }, async () => true), true)
      throw new Error('fixture rollback')
    }), /fixture rollback/)
    await flushPasswordRehashes()
    assert.equal(await storedHash(5), staleHash)
  })

  await check('a newer password wins over the queued rehash', async () => {
    const email = 'concurrent-password-change@example.invalid'
    const replacement = await makeHash('replacement-password', { algorithm: 'bcrypt', rounds: 5 })
    await insertUser(6, email)
    await db.transaction(async () => {
      assert.equal(await Auth.withVerifiedCredentials({ email, password }, async () => true), true)
      await db.updateTable('users').set({ password: replacement }).where('id', '=', 6).execute()
    })
    await flushPasswordRehashes()
    assert.equal(await storedHash(6), replacement)
  })

  assert.deepEqual(failures, [])
  console.log('password rehash logins OK')
}
finally {
  RateLimiter.useMemoryStore()
  try { await releaseOrm() }
  catch {}
  await closeDatabaseConnection()
}
