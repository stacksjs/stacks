import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { basename, dirname } from 'node:path'
import { setSystemTime } from 'bun:test'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_EMAIL_CLAIM_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-email-claim-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_email_claim_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overrides, overridesReady } = await import('@stacksjs/config')
await overridesReady
const signingKey = 'synthetic-email-verification-fixture-key'
overrides.app = { ...overrides.app, key: signingKey }
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { verifyEmail } = await import('../../src/email-verification')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { registerPersistentQueryHooks } = await import('@stacksjs/query-builder')
const failures: string[] = []
const now = new Date('2030-01-02T03:04:05.000Z')
const token = 'synthetic-nonce'
const hash = (nonce: string) => createHmac('sha256', signingKey).update(`1:${nonce}`).digest('hex')
async function check(name: string, run: () => Promise<void>) {
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
async function seed(offset: number = 60_000) {
  await db.deleteFrom('email_verifications').execute()
  await db.deleteFrom('users').execute()
  await db.insertInto('users').values({ id: 1 } as never).execute()
  await db.insertInto('email_verifications').values({ user_id: 1, token: hash(token), expires_at: sqlDateTime(new Date(now.getTime() + offset)) } as never).execute()
}
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY)').execute()
  await ensureFrameworkAuthTables()
  setSystemTime(now)
  // The shipped MySQL DATETIME column stores whole seconds, unlike the
  // SQLite/Postgres columns. Test its representable boundary, not rounded ms.
  for (const offset of dialect === 'mysql' ? [-1000, 0, 1000] : [-1, 0, 1]) {
    await check(`expiry boundary ${offset}`, async () => {
      await seed(offset)
      assert.equal((await verifyEmail(1, token)).success, offset > 0)
    })
  }
  await check('one concurrent consumer', async () => {
    await seed()
    const results = await Promise.all(Array.from({ length: 8 }, () => verifyEmail(1, token)))
    assert.equal(results.filter(result => result.success).length, 1)
    assert.equal((await verifyEmail(1, token)).success, false)
  })
  await check('invalid token does not consume the valid one', async () => {
    await seed()
    assert.equal((await verifyEmail(1, 'wrong')).success, false)
    assert.equal((await verifyEmail(1, token)).success, true)
  })
  await check('missing user cannot be verified', async () => {
    await seed()
    await db.deleteFrom('users').execute()
    assert.equal((await verifyEmail(1, token)).success, false)
  })
  await check('an already verified owner remains idempotent', async () => {
    await seed()
    await db.updateTable('users').set({ email_verified_at: sqlDateTime() }).where('id', '=', 1).execute()
    assert.equal((await verifyEmail(1, token)).success, true)
    assert.equal((await verifyEmail(1, token)).success, false)
  })
  await check('an outer rollback restores both user and token', async () => {
    await seed()
    await assert.rejects(db.transaction(async () => {
      assert.equal((await verifyEmail(1, token)).success, true)
      throw new Error('synthetic outer rollback')
    }), /synthetic outer rollback/)
    assert.equal((await db.primary.selectFrom('users').where('id', '=', 1).selectAll().executeTakeFirst())?.email_verified_at, null)
    assert.equal((await verifyEmail(1, token)).success, true)
  })
  await check('failed user write preserves the token', async () => {
    await seed()
    if (dialect === 'postgres') {
      await db.unsafe("CREATE FUNCTION reject_email_mark() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic email mark failure'; END; $$").execute()
      await db.unsafe('CREATE TRIGGER reject_email_mark BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION reject_email_mark()').execute()
    }
    else if (dialect === 'mysql')
      await db.unsafe("CREATE TRIGGER reject_email_mark BEFORE UPDATE ON users FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic email mark failure'").execute()
    else
      await db.unsafe("CREATE TRIGGER reject_email_mark BEFORE UPDATE ON users BEGIN SELECT RAISE(ABORT, 'synthetic email mark failure'); END").execute()
    try {
      await assert.rejects(() => verifyEmail(1, token), /synthetic email mark failure/)
      assert.equal((await db.primary.selectFrom('email_verifications').selectAll().execute()).length, 1)
    }
    finally {
      await db.unsafe(`DROP TRIGGER reject_email_mark${dialect === 'postgres' ? ' ON users' : ''}`).execute()
      if (dialect === 'postgres') await db.unsafe('DROP FUNCTION reject_email_mark()').execute()
    }
    assert.equal((await verifyEmail(1, token)).success, true)
  })
  await check('failed consumption does not mark the user verified', async () => {
    await seed()
    if (dialect === 'postgres') {
      await db.unsafe("CREATE FUNCTION reject_email_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic email delete failure'; END; $$").execute()
      await db.unsafe('CREATE TRIGGER reject_email_delete BEFORE DELETE ON email_verifications FOR EACH ROW EXECUTE FUNCTION reject_email_delete()').execute()
    }
    else if (dialect === 'mysql')
      await db.unsafe("CREATE TRIGGER reject_email_delete BEFORE DELETE ON email_verifications FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic email delete failure'").execute()
    else
      await db.unsafe("CREATE TRIGGER reject_email_delete BEFORE DELETE ON email_verifications BEGIN SELECT RAISE(ABORT, 'synthetic email delete failure'); END").execute()
    try {
      await assert.rejects(() => verifyEmail(1, token), /synthetic email delete failure/)
      assert.equal((await db.primary.selectFrom('users').where('id', '=', 1).selectAll().executeTakeFirst())?.email_verified_at, null)
    }
    finally {
      await db.unsafe(`DROP TRIGGER reject_email_delete${dialect === 'postgres' ? ' ON email_verifications' : ''}`).execute()
      if (dialect === 'postgres') await db.unsafe('DROP FUNCTION reject_email_delete()').execute()
    }
  })
  if (dialect !== 'mysql') {
    await check('a suppressed user update cannot consume the token', async () => {
      await seed()
      if (dialect === 'postgres') {
        await db.unsafe('CREATE FUNCTION ignore_email_mark() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$').execute()
        await db.unsafe('CREATE TRIGGER ignore_email_mark BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION ignore_email_mark()').execute()
      }
      else
        await db.unsafe('CREATE TRIGGER ignore_email_mark BEFORE UPDATE ON users BEGIN SELECT RAISE(IGNORE); END').execute()
      try {
        await assert.rejects(() => verifyEmail(1, token), /could not update the user/)
        assert.equal((await db.primary.selectFrom('email_verifications').selectAll().execute()).length, 1)
        assert.equal((await db.primary.selectFrom('users').where('id', '=', 1).selectAll().executeTakeFirst())?.email_verified_at, null)
      }
      finally {
        await db.unsafe(`DROP TRIGGER ignore_email_mark${dialect === 'postgres' ? ' ON users' : ''}`).execute()
        if (dialect === 'postgres') await db.unsafe('DROP FUNCTION ignore_email_mark()').execute()
      }
    })
  }
  await check('a token expiring while waiting for the owner lock is rejected', async () => {
    await seed()
    let advanced = false
    const stop = registerPersistentQueryHooks({ onQueryStart(event) {
      if (event.kind === 'select' && /\busers\b/.test(event.sql)) {
        setSystemTime(new Date(now.getTime() + 60_000))
        advanced = true
      }
    } })
    try {
      assert.equal((await verifyEmail(1, token)).success, false)
      assert(advanced)
      assert.equal((await db.primary.selectFrom('users').where('id', '=', 1).selectAll().executeTakeFirst())?.email_verified_at, null)
    }
    finally { stop(); setSystemTime(now) }
  })
  assert.deepEqual(failures, [], failures.join('\n'))
  console.log('email verification consumption OK')
}
finally {
  setSystemTime()
  await closeDatabaseConnection()
}
