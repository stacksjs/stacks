import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_TWO_FACTOR_STATE_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-two-factor-state-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_two_factor_state_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { enableTwoFactor, disableTwoFactor, getTwoFactorState } = await import('../../src/two-factor')
const { generateTwoFactorToken } = await import('../../src/authenticator')
const secret = 'JBSWY3DPEHPK3PXP'
const otherSecret = 'GEZDGNBVGY3TQOJQ'
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
async function seed(enabled: boolean) {
  await db.deleteFrom('users').execute()
  await db.insertInto('users').values([
    { id: 1, two_factor_secret: enabled ? secret : null, two_factor_enabled: enabled },
    { id: 2, two_factor_secret: otherSecret, two_factor_enabled: true },
  ]).execute()
}
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, two_factor_secret VARCHAR(255), two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE)').execute()
  await check('missing owner cannot be reported enabled', async () => {
    assert.equal(await enableTwoFactor(99, secret, await generateTwoFactorToken(secret)), false)
    await disableTwoFactor(99)
  })
  await check('valid changes and repeated same-state writes succeed', async () => {
    await seed(false)
    const code = await generateTwoFactorToken(secret)
    assert.equal(await enableTwoFactor(1, secret, code), true)
    assert.equal(await enableTwoFactor(1, secret, code), true)
    assert.deepEqual(await getTwoFactorState(1), { secret, enabled: true })
    await disableTwoFactor(1)
    await disableTwoFactor(1)
    assert.deepEqual(await getTwoFactorState(1), { secret: null, enabled: false })
    assert.deepEqual(await getTwoFactorState(2), { secret: otherSecret, enabled: true })
  })
  for (const enabling of [true, false]) {
    await check(`${enabling ? 'enable' : 'disable'} respects outer rollback`, async () => {
      await seed(!enabling)
      const before = await getTwoFactorState(1)
      await assert.rejects(db.transaction(async () => {
        if (enabling) assert.equal(await enableTwoFactor(1, secret, await generateTwoFactorToken(secret)), true)
        else await disableTwoFactor(1)
        throw new Error('fixture rollback')
      }), /fixture rollback/)
      assert.deepEqual(await getTwoFactorState(1), before)
    })
    for (const effect of ['suppressed', 'wrong-secret']) {
      await check(`${enabling ? 'enable' : 'disable'} ${effect} write cannot report success`, async () => {
        await seed(!enabling)
        const before = await getTwoFactorState(1)
        if (dialect === 'postgres') {
          const body = effect === 'suppressed' ? 'RETURN NULL;' : `NEW.two_factor_secret := '${otherSecret}'; RETURN NEW;`
          await db.unsafe(`CREATE FUNCTION alter_two_factor() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${body} END; $$`).execute()
          await db.unsafe('CREATE TRIGGER alter_two_factor BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION alter_two_factor()').execute()
        }
        else if (dialect === 'mysql') {
          const body = effect === 'suppressed' ? 'NEW.two_factor_secret = OLD.two_factor_secret, NEW.two_factor_enabled = OLD.two_factor_enabled' : `NEW.two_factor_secret = '${otherSecret}'`
          await db.unsafe(`CREATE TRIGGER alter_two_factor BEFORE UPDATE ON users FOR EACH ROW SET ${body}`).execute()
        }
        else {
          const body = effect === 'suppressed' ? 'SELECT RAISE(IGNORE)' : `UPDATE users SET two_factor_secret = '${otherSecret}' WHERE id = NEW.id`
          await db.unsafe(`CREATE TRIGGER alter_two_factor ${effect === 'suppressed' ? 'BEFORE' : 'AFTER'} UPDATE ON users BEGIN ${body}; END`).execute()
        }
        try {
          if (enabling)
            await assert.rejects(enableTwoFactor(1, secret, await generateTwoFactorToken(secret)), 'an unpersisted 2FA enable must fail')
          else
            await assert.rejects(disableTwoFactor(1), 'an unpersisted 2FA disable must fail')
          assert.deepEqual(await getTwoFactorState(1), before, 'partial or altered writes must roll back')
          assert.deepEqual(await getTwoFactorState(2), { secret: otherSecret, enabled: true })
        }
        finally {
          await db.unsafe(`DROP TRIGGER alter_two_factor${dialect === 'postgres' ? ' ON users' : ''}`).execute()
          if (dialect === 'postgres') await db.unsafe('DROP FUNCTION alter_two_factor()').execute()
        }
      })
    }
  }
  assert.deepEqual(failures, [])
  console.log('two-factor state atomicity OK')
}
finally { await closeDatabaseConnection() }
