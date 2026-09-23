import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_TWO_FACTOR_SETUP_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-two-factor-setup-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_two_factor_setup_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { stashPendingTwoFactorSecret, consumePendingTwoFactorSecret } = await import('../../src/two-factor')
if (process.argv[2] === 'worker') {
  try { await stashPendingTwoFactorSecret(1, process.argv[3]!) }
  finally { await closeDatabaseConnection() }
  process.exit(0)
}
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  await db.deleteFrom('two_factor_pending_secrets').execute()
  await db.insertInto('two_factor_pending_secrets').values({ user_id: 1, secret: 'synthetic-previous', expires_at: sqlDateTime(new Date(Date.now() + 60_000)) }).execute()
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
async function current() {
  return db.primary.selectFrom('two_factor_pending_secrets').where('user_id', '=', 1).selectAll().executeTakeFirst()
}
try {
  const timestamp = dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  await db.unsafe(`CREATE TABLE two_factor_pending_secrets (user_id INTEGER PRIMARY KEY, secret VARCHAR(255) NOT NULL, expires_at ${timestamp} NOT NULL, created_at ${timestamp} DEFAULT ${dialect === 'mysql' ? 'CURRENT_TIMESTAMP(3)' : 'CURRENT_TIMESTAMP'})`).execute()
  await check('failed storage preserves the previous setup', async () => {
    if (dialect === 'postgres') {
      await db.unsafe("CREATE FUNCTION reject_setup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture setup denied'; END; $$").execute()
      await db.unsafe('CREATE TRIGGER reject_setup BEFORE INSERT ON two_factor_pending_secrets FOR EACH ROW EXECUTE FUNCTION reject_setup()').execute()
    }
    else if (dialect === 'mysql')
      await db.unsafe("CREATE TRIGGER reject_setup BEFORE INSERT ON two_factor_pending_secrets FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture setup denied'").execute()
    else
      await db.unsafe("CREATE TRIGGER reject_setup BEFORE INSERT ON two_factor_pending_secrets BEGIN SELECT RAISE(ABORT, 'fixture setup denied'); END").execute()
    try {
      await assert.rejects(stashPendingTwoFactorSecret(1, 'synthetic-next'), /fixture setup denied/)
      assert.equal((await current())?.secret, 'synthetic-previous')
    }
    finally {
      await db.unsafe(`DROP TRIGGER reject_setup${dialect === 'postgres' ? ' ON two_factor_pending_secrets' : ''}`).execute()
      if (dialect === 'postgres') await db.unsafe('DROP FUNCTION reject_setup()').execute()
    }
  })
  if (dialect !== 'mysql') {
    await check('silent storage rejection cannot report a new setup', async () => {
      if (dialect === 'postgres') {
        await db.unsafe('CREATE FUNCTION suppress_setup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$').execute()
        await db.unsafe('CREATE TRIGGER suppress_setup BEFORE INSERT ON two_factor_pending_secrets FOR EACH ROW EXECUTE FUNCTION suppress_setup()').execute()
      }
      else
        await db.unsafe('CREATE TRIGGER suppress_setup BEFORE INSERT ON two_factor_pending_secrets BEGIN SELECT RAISE(IGNORE); END').execute()
      try {
        await assert.rejects(stashPendingTwoFactorSecret(1, 'synthetic-next'))
        assert.equal((await current())?.secret, 'synthetic-previous')
      }
      finally {
        await db.unsafe(`DROP TRIGGER suppress_setup${dialect === 'postgres' ? ' ON two_factor_pending_secrets' : ''}`).execute()
        if (dialect === 'postgres') await db.unsafe('DROP FUNCTION suppress_setup()').execute()
      }
    })
  }
  await check('outer rollback preserves the previous setup', async () => {
    await assert.rejects(db.transaction(async () => {
      await stashPendingTwoFactorSecret(1, 'synthetic-next')
      throw new Error('fixture rollback')
    }), /fixture rollback/)
    assert.equal((await current())?.secret, 'synthetic-previous')
  })
  await check('repeated replacement remains usable once', async () => {
    await stashPendingTwoFactorSecret(2, 'synthetic-bystander')
    await stashPendingTwoFactorSecret(1, 'synthetic-next')
    await stashPendingTwoFactorSecret(1, 'synthetic-next')
    assert.equal(await consumePendingTwoFactorSecret(1), 'synthetic-next')
    assert.equal(await consumePendingTwoFactorSecret(1), null)
    assert.equal(await consumePendingTwoFactorSecret(2), 'synthetic-bystander')
  })
  await check('invalid expiry leaves the previous setup intact', async () => {
    await assert.rejects(stashPendingTwoFactorSecret(1, 'synthetic-next', Number.NaN))
    assert.equal((await current())?.secret, 'synthetic-previous')
  })
  for (const fresh of [false, true]) {
    await check(`independent setup processes serialize with fresh=${fresh}`, async () => {
      if (fresh) await db.deleteFrom('two_factor_pending_secrets').execute()
      const secrets = Array.from({ length: 4 }, (_, index) => `synthetic-worker-${index}`)
      const results = await Promise.allSettled(secrets.map(async secret => {
        const child = Bun.spawn([process.execPath, `--config=${configPath}`, '--no-env-file', import.meta.path, 'worker', secret], {
          env: process.env, stdout: 'pipe', stderr: 'pipe',
        })
        const watchdog = setTimeout(() => child.kill(), 8000)
        try {
          const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
          assert.equal(code, 0, `${stdout}\n${stderr}`)
        }
        finally { clearTimeout(watchdog); child.kill() }
      }))
      // Wait for every process before a failing assertion can start cleanup.
      const rejected = results.filter(result => result.status === 'rejected')
      assert.deepEqual(rejected, [], 'every concurrent setup must finish successfully')
      assert(secrets.includes(String((await current())?.secret)))
      assert.equal((await db.primary.selectFrom('two_factor_pending_secrets').selectAll().execute()).length, 1)
    })
  }
  assert.deepEqual(failures, [])
  console.log('two-factor setup atomicity OK')
}
finally { await closeDatabaseConnection() }
