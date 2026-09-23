import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_TWO_FACTOR_CHALLENGE_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-two-factor-challenge-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_two_factor_challenge_'))
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
const { createTwoFactorChallenge, consumeTwoFactorChallenge } = await import('../../src/two-factor')
const failures: string[] = []
async function rows() {
  return db.primary.selectFrom('two_factor_challenges').select(['id', 'user_id']).orderBy('id').execute()
}
async function check(name: string, run: () => Promise<void>) {
  await db.deleteFrom('two_factor_challenges').execute()
  await db.insertInto('two_factor_challenges').values([
    { id: 'synthetic-old', user_id: 1, expires_at: sqlDateTime(new Date(Date.now() + 60_000)) },
    { id: 'synthetic-bystander', user_id: 2, expires_at: sqlDateTime(new Date(Date.now() + 60_000)) },
  ]).execute()
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
try {
  await db.unsafe('CREATE TABLE two_factor_challenges (id VARCHAR(255) PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TIMESTAMP NOT NULL)').execute()
  for (const effect of dialect === 'mysql' ? ['rejected', 'altered'] : ['rejected', 'suppressed', 'altered']) {
    await check(`${effect} login challenge replacement preserves the old one`, async () => {
      const before = await rows()
      if (dialect === 'postgres') {
        const body = effect === 'rejected' ? "RAISE EXCEPTION 'fixture write denied';" : effect === 'suppressed' ? 'RETURN NULL;' : "NEW.id := 'altered'; RETURN NEW;"
        await db.unsafe(`CREATE FUNCTION alter_challenge() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${body} END; $$`).execute()
        await db.unsafe('CREATE TRIGGER alter_challenge BEFORE INSERT ON two_factor_challenges FOR EACH ROW EXECUTE FUNCTION alter_challenge()').execute()
      }
      else if (dialect === 'mysql') {
        const body = effect === 'rejected' ? "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture write denied'" : "SET NEW.id = 'altered'"
        await db.unsafe(`CREATE TRIGGER alter_challenge BEFORE INSERT ON two_factor_challenges FOR EACH ROW ${body}`).execute()
      }
      else {
        const body = effect === 'rejected' ? "SELECT RAISE(ABORT, 'fixture write denied')" : effect === 'suppressed' ? 'SELECT RAISE(IGNORE)' : "UPDATE two_factor_challenges SET id = 'altered' WHERE id = NEW.id"
        await db.unsafe(`CREATE TRIGGER alter_challenge ${effect === 'altered' ? 'AFTER' : 'BEFORE'} INSERT ON two_factor_challenges BEGIN ${body}; END`).execute()
      }
      try {
        await assert.rejects(createTwoFactorChallenge(1))
        assert.deepEqual(await rows(), before)
      }
      finally {
        await db.unsafe(`DROP TRIGGER alter_challenge${dialect === 'postgres' ? ' ON two_factor_challenges' : ''}`).execute()
        if (dialect === 'postgres') await db.unsafe('DROP FUNCTION alter_challenge()').execute()
      }
    })
  }
  await check('outer rollback retains the old login challenge', async () => {
    const before = await rows()
    await assert.rejects(db.transaction(async () => {
      await createTwoFactorChallenge(1)
      throw new Error('fixture rollback')
    }), /fixture rollback/)
    assert.deepEqual(await rows(), before)
  })
  await check('a successful replacement invalidates only its owner and consumes once', async () => {
    const token = await createTwoFactorChallenge(1)
    assert.notEqual(token, 'synthetic-old')
    assert.equal(await consumeTwoFactorChallenge('synthetic-old'), null)
    assert.equal(await consumeTwoFactorChallenge(token), 1)
    assert.equal(await consumeTwoFactorChallenge(token), null)
    assert.equal(await consumeTwoFactorChallenge('synthetic-bystander'), 2)
  })
  assert.deepEqual(failures, [])
  console.log('two-factor challenge atomicity OK')
}
finally { await closeDatabaseConnection() }
