import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_SESSION_REVOKE_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-session-revoke-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_session_revoke_'))
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
const { SessionAuth } = await import('../../src/session-auth')
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
async function seed() {
  await db.deleteFrom('sessions').execute()
  for (const [id, owner] of [['target', 1], ['second', 1], ['bystander', 2]] as const)
    await db.insertInto('sessions').values({ id, user_id: owner, expires_at: sqlDateTime(new Date(Date.now() + 60_000)), last_activity: 0 }).execute()
}
try {
  await db.unsafe('CREATE TABLE sessions (id VARCHAR(255) PRIMARY KEY, user_id INTEGER, expires_at TIMESTAMP, last_activity INTEGER)').execute()
  for (const bulk of [false, true]) {
    const revoke = () => bulk ? SessionAuth.destroyAll(1) : SessionAuth.logout('target')
    if (dialect !== 'mysql') {
      await check(`${bulk ? 'bulk' : 'individual'} silently skipped deletion fails atomically`, async () => {
        await seed()
        if (dialect === 'postgres') {
          await db.unsafe("CREATE FUNCTION suppress_session_revoke() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id = 'target' THEN RETURN NULL; END IF; RETURN OLD; END; $$").execute()
          await db.unsafe('CREATE TRIGGER suppress_session_revoke BEFORE DELETE ON sessions FOR EACH ROW EXECUTE FUNCTION suppress_session_revoke()').execute()
        }
        else
          await db.unsafe("CREATE TRIGGER suppress_session_revoke BEFORE DELETE ON sessions WHEN OLD.id = 'target' BEGIN SELECT RAISE(IGNORE); END").execute()
        try {
          await assert.rejects(revoke(), 'logout must not succeed while the selected session remains usable')
          for (const id of ['target', 'second', 'bystander'])
            assert.equal(await SessionAuth.check(id), true, 'a failed revocation must roll back every selected deletion')
        }
        finally {
          await db.unsafe(`DROP TRIGGER suppress_session_revoke${dialect === 'postgres' ? ' ON sessions' : ''}`).execute()
          if (dialect === 'postgres') await db.unsafe('DROP FUNCTION suppress_session_revoke()').execute()
        }
      })
    }
    await check(`${bulk ? 'bulk' : 'individual'} logout preserves other owners and is idempotent`, async () => {
      await seed()
      await revoke()
      assert.equal(await SessionAuth.check('target'), false)
      assert.equal(await SessionAuth.check('second'), !bulk)
      assert.equal(await SessionAuth.check('bystander'), true)
      await revoke()
    })
    await check(`${bulk ? 'bulk' : 'individual'} outer rollback restores the selected sessions`, async () => {
      await seed()
      await assert.rejects(db.transaction(async () => {
        await revoke()
        throw new Error('fixture outer rollback')
      }), /fixture outer rollback/)
      for (const id of ['target', 'second', 'bystander']) assert.equal(await SessionAuth.check(id), true)
    })
  }
  await check('a missing optional sessions table preserves an outer transaction', async () => {
    await db.unsafe('DROP TABLE sessions').execute()
    await db.unsafe('CREATE TABLE owner_probe (id INTEGER PRIMARY KEY)').execute()
    await db.transaction(async () => {
      await db.insertInto('owner_probe').values({ id: 1 }).execute()
      await SessionAuth.destroyAll(1)
      await db.insertInto('owner_probe').values({ id: 2 }).execute()
    })
    assert.equal((await db.primary.selectFrom('owner_probe').selectAll().execute()).length, 2)
  })
  assert.deepEqual(failures, [])
  console.log('session revocation atomicity OK')
}
finally { await closeDatabaseConnection() }
