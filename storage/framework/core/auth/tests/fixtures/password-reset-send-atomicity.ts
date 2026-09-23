import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_RESET_SEND_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-reset-send-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_reset_send_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
let sent = 0
const delivered: string[] = []
let failDelivery = false
mock.module('@stacksjs/email', () => ({
  template: async (_name: string, options: { variables: { resetUrl: string } }) => ({ text: options.variables.resetUrl }),
  mail: { sendOrFail: async (message: { text: string }) => {
    if (failDelivery) throw new Error('fixture delivery unavailable')
    sent++
    delivered.push(message.text)
  } },
}))
const { overrides, overridesReady } = await import('@stacksjs/config')
await overridesReady
overrides.app = { ...overrides.app, key: 'synthetic-reset-send-key' }
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { passwordResets } = await import('../../src/password/reset')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const user = { id: 1, email: 'synthetic@example.invalid' }
if (process.argv[2] === 'send-worker') {
  try {
    await passwordResets(user.email).sendEmail()
    console.log(JSON.stringify({ delivered }))
  }
  finally { await closeDatabaseConnection() }
  process.exit(0)
}
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
async function seed() {
  sent = 0
  delivered.length = 0
  await db.deleteFrom('password_resets').execute()
  await db.insertInto('password_resets').values({ email: user.email, token: 'previous-hash', expires_at: sqlDateTime(new Date(Date.now() + 60_000)) }).execute()
}
async function hashes() {
  return (await db.primary.selectFrom('password_resets').selectAll().execute()).map(row => row.token)
}
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(255))').execute()
  await db.insertInto('users').values({ id: 1, email: user.email }).execute()
  await ensureFrameworkAuthTables()
  await check('failed replacement preserves the previous link and sends nothing', async () => {
    await seed()
    if (dialect === 'postgres') {
      await db.unsafe("CREATE FUNCTION reject_reset_send() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture replacement denied'; END; $$").execute()
      await db.unsafe('CREATE TRIGGER reject_reset_send BEFORE INSERT ON password_resets FOR EACH ROW EXECUTE FUNCTION reject_reset_send()').execute()
    }
    else if (dialect === 'mysql')
      await db.unsafe("CREATE TRIGGER reject_reset_send BEFORE INSERT ON password_resets FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture replacement denied'").execute()
    else
      await db.unsafe("CREATE TRIGGER reject_reset_send BEFORE INSERT ON password_resets BEGIN SELECT RAISE(ABORT, 'fixture replacement denied'); END").execute()
    try {
      await assert.rejects(passwordResets(user.email).sendEmail(), /fixture replacement denied/)
      assert.deepEqual(await hashes(), ['previous-hash'])
      assert.equal(sent, 0)
    }
    finally {
      await db.unsafe(`DROP TRIGGER reject_reset_send${dialect === 'postgres' ? ' ON password_resets' : ''}`).execute()
      if (dialect === 'postgres') await db.unsafe('DROP FUNCTION reject_reset_send()').execute()
    }
  })
  await check('outer rollback never delivers an invalid link', async () => {
    await seed()
    await assert.rejects(db.transaction(async () => {
      await passwordResets(user.email).sendEmail()
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
          await db.unsafe('CREATE FUNCTION suppress_reset_send() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$').execute()
          await db.unsafe(`CREATE TRIGGER suppress_reset_send BEFORE ${operation} ON password_resets FOR EACH ROW EXECUTE FUNCTION suppress_reset_send()`).execute()
        }
        else
          await db.unsafe(`CREATE TRIGGER suppress_reset_send BEFORE ${operation} ON password_resets BEGIN SELECT RAISE(IGNORE); END`).execute()
        try {
          await assert.rejects(passwordResets(user.email).sendEmail(), 'a silently skipped write must not send a link')
          assert.deepEqual(await hashes(), ['previous-hash'])
          assert.equal(sent, 0)
        }
        finally {
          await db.unsafe(`DROP TRIGGER suppress_reset_send${dialect === 'postgres' ? ' ON password_resets' : ''}`).execute()
          if (dialect === 'postgres') await db.unsafe('DROP FUNCTION suppress_reset_send()').execute()
        }
      })
    }
  }
  await check('outer commit delivers only after the token exists durably', async () => {
    await seed()
    await db.transaction(async () => {
      await passwordResets(user.email).sendEmail()
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
    try { await assert.rejects(passwordResets(user.email).sendEmail(), /fixture delivery unavailable/) }
    finally { failDelivery = false }
  })
  for (const legacy of [false, true]) {
    await check(`${legacy ? 'legacy' : 'indexed'} independent sends all finish with one surviving link`, async () => {
      if (legacy)
        await db.unsafe(`DROP INDEX idx_password_resets_email_unique${dialect === 'mysql' ? ' ON password_resets' : ''}`).execute()
      await seed()
      await db.insertInto('password_resets').values({ email: 'bystander@example.invalid', token: 'bystander-hash' }).execute()
      const results = await Promise.allSettled(Array.from({ length: 4 }, async () => {
        const child = Bun.spawn([process.execPath, `--config=${configPath}`, '--no-env-file', import.meta.path, 'send-worker'], {
          env: process.env, stdout: 'pipe', stderr: 'pipe',
        })
        const watchdog = setTimeout(() => child.kill(), 10_000)
        try {
          const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
          assert.equal(code, 0, `${stdout}\n${stderr}`)
          const messages = JSON.parse(stdout.trim().split('\n').at(-1)!).delivered as string[]
          assert.equal(messages.length, 1)
          const raw = /\/password\/reset\/([a-f0-9]+)/.exec(messages[0]!)?.[1]
          assert(raw)
          return raw
        }
        finally { clearTimeout(watchdog); child.kill() }
      }))
      const failed = results.filter(result => result.status === 'rejected')
      assert.equal(failed.length, 0, failed.map(result => String(result.reason)).join('\n'))
      const tokens = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
      const validity = await Promise.all(tokens.map(token => passwordResets(user.email).verifyToken(token)))
      assert.equal(validity.filter(Boolean).length, 1, 'only the last replacement may remain usable')
      const rows = await db.primary.selectFrom('password_resets').selectAll().execute()
      assert.equal(rows.length, 2)
      assert(rows.some(row => row.email === 'bystander@example.invalid' && row.token === 'bystander-hash'))
    })
  }
  assert.deepEqual(failures, [])
  console.log('reset send atomicity OK')
}
finally { await closeDatabaseConnection() }
