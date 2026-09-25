import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import { createHash } from 'node:crypto'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_MAGIC_SEND_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-magic-send-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_magic_send_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
const messages: string[] = []
let failDelivery = false
mock.module('@stacksjs/email', () => ({
  templateByName: async () => ({ html: '', text: '' }),
  mail: { sendOrFail: async (message: { text: string }) => {
    if (failDelivery) throw new Error('fixture delivery unavailable')
    messages.push(message.text)
  } },
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
const { sendMagicLink, consumeMagicLink } = await import('../../src/magic-link')
const { RateLimiter } = await import('../../src/rate-limiter')
const email = 'synthetic@example.invalid'
if (process.argv[2] === 'send-worker') {
  try {
    await sendMagicLink(email)
    console.log(JSON.stringify({ delivered: messages.map(message => {
      const raw = /\/auth\/magic\/([\w-]+)/.exec(message)?.[1]
      assert(raw)
      return createHash('sha256').update(raw).digest('hex')
    }) }))
  }
  finally { await closeDatabaseConnection() }
  process.exit(0)
}
const previousHash = createHash('sha256').update('synthetic-previous-token').digest('hex')
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  messages.length = 0
  RateLimiter.useMemoryStore()
  await db.deleteFrom('magic_link_tokens').execute()
  await db.insertInto('magic_link_tokens').values({ user_id: 1, email, token: previousHash, consumed_at: null,
    expires_at: sqlDateTime(new Date(Date.now() + 60_000)) }).execute()
  try { await run(); console.log(`PASS ${name}`) }
  // The message only, never the formatted error. Bun prints a code frame with
  // it, and for a failure raised inside `bun:sqlite` that frame is two
  // kilobytes of the driver's own source - which is what reaches CI, where it
  // is truncated to exactly the part that says nothing.
  catch (error) { failures.push(`${name}: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`) }
}
/** A child's stderr, cut to the lines that name the failure. See `check`. */
function briefly(stderr: string): string {
  const lines = stderr.split('\n').map(line => line.trim()).filter(Boolean)
  const named = lines.filter(line => /^(?:error|[A-Za-z]*Error):/.test(line))
  return (named.length > 0 ? named : lines.slice(-3)).join(' | ').slice(0, 400)
}
async function hashes() {
  return (await db.primary.selectFrom('magic_link_tokens').whereNull('consumed_at').selectAll().execute()).map(row => row.token)
}
try {
  const id = dialect === 'sqlite' ? 'INTEGER PRIMARY KEY' : dialect === 'mysql' ? 'INTEGER PRIMARY KEY AUTO_INCREMENT' : 'BIGSERIAL PRIMARY KEY'
  await db.unsafe(`CREATE TABLE users (id ${id}, email VARCHAR(255) UNIQUE, name TEXT, password TEXT, created_at TIMESTAMP, updated_at TIMESTAMP)`).execute()
  await db.unsafe(`CREATE TABLE magic_link_tokens (id ${id}, email VARCHAR(255), user_id INTEGER, token VARCHAR(64) UNIQUE, expires_at TIMESTAMP, consumed_at TIMESTAMP, redirect_to TEXT, site_id INTEGER, created_at TIMESTAMP, updated_at TIMESTAMP)`).execute()
  await db.insertInto('users').values({ email }).execute()
  await check('failed replacement preserves the previous link and sends nothing', async () => {
    if (dialect === 'postgres') {
      await db.unsafe("CREATE FUNCTION reject_magic_send() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture replacement denied'; END; $$").execute()
      await db.unsafe('CREATE TRIGGER reject_magic_send BEFORE INSERT ON magic_link_tokens FOR EACH ROW EXECUTE FUNCTION reject_magic_send()').execute()
    }
    else if (dialect === 'mysql')
      await db.unsafe("CREATE TRIGGER reject_magic_send BEFORE INSERT ON magic_link_tokens FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture replacement denied'").execute()
    else
      await db.unsafe("CREATE TRIGGER reject_magic_send BEFORE INSERT ON magic_link_tokens BEGIN SELECT RAISE(ABORT, 'fixture replacement denied'); END").execute()
    try {
      await assert.rejects(sendMagicLink(email), /fixture replacement denied/)
      assert.deepEqual(await hashes(), [previousHash])
      assert.equal(messages.length, 0)
    }
    finally {
      await db.unsafe(`DROP TRIGGER reject_magic_send${dialect === 'postgres' ? ' ON magic_link_tokens' : ''}`).execute()
      if (dialect === 'postgres') await db.unsafe('DROP FUNCTION reject_magic_send()').execute()
    }
  })
  await check('outer rollback never delivers an invalid link', async () => {
    await assert.rejects(db.transaction(async () => {
      await sendMagicLink(email)
      throw new Error('fixture rollback')
    }), /fixture rollback/)
    assert.deepEqual(await hashes(), [previousHash])
    assert.equal(messages.length, 0)
  })
  if (dialect !== 'mysql') {
    for (const operation of ['INSERT', 'DELETE']) {
      await check(`suppressed ${operation} cannot report a replacement`, async () => {
        if (dialect === 'postgres') {
          await db.unsafe('CREATE FUNCTION suppress_magic_send() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$').execute()
          await db.unsafe(`CREATE TRIGGER suppress_magic_send BEFORE ${operation} ON magic_link_tokens FOR EACH ROW EXECUTE FUNCTION suppress_magic_send()`).execute()
        }
        else
          await db.unsafe(`CREATE TRIGGER suppress_magic_send BEFORE ${operation} ON magic_link_tokens BEGIN SELECT RAISE(IGNORE); END`).execute()
        try {
          await assert.rejects(sendMagicLink(email), 'a silently skipped write must not send a link')
          assert.deepEqual(await hashes(), [previousHash])
          assert.equal(messages.length, 0)
        }
        finally {
          await db.unsafe(`DROP TRIGGER suppress_magic_send${dialect === 'postgres' ? ' ON magic_link_tokens' : ''}`).execute()
          if (dialect === 'postgres') await db.unsafe('DROP FUNCTION suppress_magic_send()').execute()
        }
      })
    }
  }
  await check('outer commit delivers a usable token only after commit', async () => {
    await db.transaction(async () => {
      await sendMagicLink(email)
      assert.equal(messages.length, 0)
    })
    assert.equal(messages.length, 1)
    const raw = /\/auth\/magic\/([\w-]+)/.exec(messages[0]!)?.[1]
    assert(raw)
    assert.equal((await consumeMagicLink(raw)).ok, true)
  })
  await check('concurrent sends leave exactly one outstanding sign-in credential', async () => {
    await Promise.all(Array.from({ length: 4 }, () => sendMagicLink(email)))
    assert.equal((await hashes()).length, 1)
    assert.equal(messages.length, 4)
    const results = await Promise.all(messages.map(async message => {
      const raw = /\/auth\/magic\/([\w-]+)/.exec(message)?.[1]
      assert(raw)
      return consumeMagicLink(raw)
    }))
    assert.equal(results.filter(result => result.ok).length, 1)
  })
  await check('invalid expiry cannot destroy an existing credential', async () => {
    await assert.rejects(sendMagicLink(email, { ttlMinutes: Number.NaN }))
    assert.deepEqual(await hashes(), [previousHash])
    assert.equal(messages.length, 0)
  })
  await check('independent send processes leave one outstanding credential', async () => {
    const delivered = await Promise.all(Array.from({ length: 4 }, async () => {
      const child = Bun.spawn([process.execPath, `--config=${configPath}`, '--no-env-file', import.meta.path, 'send-worker'], {
        env: process.env, stdout: 'pipe', stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 8000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        assert.equal(code, 0, briefly(stderr))
        const record = JSON.parse(stdout.trim().split('\n').at(-1)!)
        assert.equal(record.delivered.length, 1, 'every successful worker delivers exactly once')
        return String(record.delivered[0])
      }
      finally { clearTimeout(watchdog); child.kill() }
    }))
    const outstanding = await hashes()
    assert.equal(outstanding.length, 1, 'serialization must work across independent runtimes')
    assert(delivered.includes(String(outstanding[0])), 'the surviving token must match an actually delivered link')
  })
  await check('replacement preserves consumed history and other addresses', async () => {
    await db.insertInto('magic_link_tokens').values({ user_id: 1, email, token: 'synthetic-history', consumed_at: sqlDateTime() }).execute()
    await db.insertInto('magic_link_tokens').values({ user_id: 2, email: 'bystander@example.invalid', token: 'synthetic-bystander', consumed_at: null }).execute()
    await sendMagicLink(email)
    const rows = await db.primary.selectFrom('magic_link_tokens').selectAll().execute()
    assert.equal(rows.length, 3)
    assert(rows.some(row => row.token === 'synthetic-history'))
    assert(rows.some(row => row.token === 'synthetic-bystander'))
  })
  await check('unknown emails remain a silent no-op', async () => {
    await sendMagicLink('missing@example.invalid')
    assert.deepEqual(await hashes(), [previousHash])
    assert.equal(messages.length, 0)
  })
  await check('provider failure preserves the existing silent-send contract', async () => {
    failDelivery = true
    try { await sendMagicLink(email) }
    finally { failDelivery = false }
    assert.equal((await hashes()).length, 1)
    assert.equal(messages.length, 0)
  })
  assert.deepEqual(failures, [])
  console.log('magic-link send atomicity OK')
}
finally { await closeDatabaseConnection() }
