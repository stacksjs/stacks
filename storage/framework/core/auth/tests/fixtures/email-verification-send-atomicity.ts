import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_EMAIL_SEND_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-email-send-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_email_send_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
let sent = 0
let failDelivery = false
mock.module('@stacksjs/email', () => ({
  template: async () => ({ html: '<p>synthetic verification</p>', text: 'synthetic verification' }),
  mail: { sendOrFail: async () => {
    if (failDelivery) throw new Error('fixture delivery unavailable')
    sent++
  } },
}))
const { overrides, overridesReady } = await import('@stacksjs/config')
await overridesReady
overrides.app = { ...overrides.app, key: 'synthetic-email-send-key' }
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { sendVerificationEmail } = await import('../../src/email-verification')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const user = { id: 1, email: 'synthetic@example.invalid' }
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
async function seed() {
  sent = 0
  await db.deleteFrom('email_verifications').execute()
  await db.insertInto('email_verifications').values({ user_id: 1, token: 'previous-hash', expires_at: sqlDateTime(new Date(Date.now() + 60_000)) }).execute()
}
async function hashes() {
  return (await db.primary.selectFrom('email_verifications').selectAll().execute()).map(row => row.token)
}
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY)').execute()
  await db.insertInto('users').values({ id: 1 }).execute()
  await ensureFrameworkAuthTables()
  await check('failed replacement preserves the previous link and sends nothing', async () => {
    await seed()
    if (dialect === 'postgres') {
      await db.unsafe("CREATE FUNCTION reject_email_send() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture replacement denied'; END; $$").execute()
      await db.unsafe('CREATE TRIGGER reject_email_send BEFORE INSERT ON email_verifications FOR EACH ROW EXECUTE FUNCTION reject_email_send()').execute()
    }
    else if (dialect === 'mysql')
      await db.unsafe("CREATE TRIGGER reject_email_send BEFORE INSERT ON email_verifications FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture replacement denied'").execute()
    else
      await db.unsafe("CREATE TRIGGER reject_email_send BEFORE INSERT ON email_verifications BEGIN SELECT RAISE(ABORT, 'fixture replacement denied'); END").execute()
    try {
      await assert.rejects(sendVerificationEmail(user), /fixture replacement denied/)
      assert.deepEqual(await hashes(), ['previous-hash'])
      assert.equal(sent, 0)
    }
    finally {
      await db.unsafe(`DROP TRIGGER reject_email_send${dialect === 'postgres' ? ' ON email_verifications' : ''}`).execute()
      if (dialect === 'postgres') await db.unsafe('DROP FUNCTION reject_email_send()').execute()
    }
  })
  await check('outer rollback never delivers an invalid link', async () => {
    await seed()
    await assert.rejects(db.transaction(async () => {
      await sendVerificationEmail(user)
      throw new Error('fixture rollback')
    }), /fixture rollback/)
    assert.deepEqual(await hashes(), ['previous-hash'])
    assert.equal(sent, 0)
  })
  if (dialect !== 'mysql') {
    for (const operation of ['INSERT', 'DELETE']) {
      await check(`suppressed ${operation} cannot report a replacement`, async () => {
        await seed()
        if (dialect === 'postgres') {
          await db.unsafe('CREATE FUNCTION suppress_email_send() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$').execute()
          await db.unsafe(`CREATE TRIGGER suppress_email_send BEFORE ${operation} ON email_verifications FOR EACH ROW EXECUTE FUNCTION suppress_email_send()`).execute()
        }
        else
          await db.unsafe(`CREATE TRIGGER suppress_email_send BEFORE ${operation} ON email_verifications BEGIN SELECT RAISE(IGNORE); END`).execute()
        try {
          await assert.rejects(sendVerificationEmail(user), 'a silently skipped write must not send a link')
          assert.deepEqual(await hashes(), ['previous-hash'])
          assert.equal(sent, 0)
        }
        finally {
          await db.unsafe(`DROP TRIGGER suppress_email_send${dialect === 'postgres' ? ' ON email_verifications' : ''}`).execute()
          if (dialect === 'postgres') await db.unsafe('DROP FUNCTION suppress_email_send()').execute()
        }
      })
    }
  }
  await check('outer commit delivers only after the token exists durably', async () => {
    await seed()
    await db.transaction(async () => {
      await sendVerificationEmail(user)
      assert.equal(sent, 0, 'mail cannot escape before the outer commit')
    })
    assert.equal(sent, 1)
    const current = await hashes()
    assert.equal(current.length, 1)
    assert.notEqual(current[0], 'previous-hash')
  })
  await check('standalone delivery failure remains visible to the caller', async () => {
    await seed()
    failDelivery = true
    try { await assert.rejects(sendVerificationEmail(user), /fixture delivery unavailable/) }
    finally { failDelivery = false }
  })
  assert.deepEqual(failures, [])
  console.log('verification send atomicity OK')
}
finally { await closeDatabaseConnection() }
