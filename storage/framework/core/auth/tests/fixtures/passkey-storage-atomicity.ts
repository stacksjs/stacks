import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_PASSKEY_STORAGE_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-passkey-storage-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_passkey_storage_'))
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
const { storeWebAuthnChallenge, consumeWebAuthnChallenge } = await import('../../src/passkey')
const previous = Buffer.from('synthetic previous challenge').toString('base64url')
const next = new Uint8Array([9, 8, 7])
const failures: string[] = []
async function rows() {
  return db.primary.selectFrom('webauthn_challenges').select(['user_id', 'purpose', 'challenge']).orderBy('user_id').orderBy('purpose').execute()
}
async function check(name: string, run: () => Promise<void>) {
  await db.deleteFrom('webauthn_challenges').execute()
  await db.insertInto('webauthn_challenges').values([
    { user_id: 1, purpose: 'authentication', challenge: previous, expires_at: sqlDateTime(new Date(Date.now() + 60_000)) },
    { user_id: 1, purpose: 'registration', challenge: 'same-owner-other-purpose', expires_at: sqlDateTime(new Date(Date.now() + 60_000)) },
    { user_id: 2, purpose: 'authentication', challenge: 'other-owner', expires_at: sqlDateTime(new Date(Date.now() + 60_000)) },
  ]).execute()
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
try {
  const id = dialect === 'sqlite' ? 'INTEGER PRIMARY KEY' : dialect === 'mysql' ? 'INTEGER PRIMARY KEY AUTO_INCREMENT' : 'BIGSERIAL PRIMARY KEY'
  await db.unsafe(`CREATE TABLE webauthn_challenges (id ${id}, user_id INTEGER NOT NULL, purpose VARCHAR(255) NOT NULL, challenge VARCHAR(255) NOT NULL, expires_at TIMESTAMP NOT NULL)`).execute()
  await db.unsafe('CREATE UNIQUE INDEX unique_challenge ON webauthn_challenges(user_id, purpose)').execute()
  for (const legacy of [false, true]) {
    if (legacy) await db.unsafe(`DROP INDEX unique_challenge${dialect === 'mysql' ? ' ON webauthn_challenges' : ''}`).execute()
    for (const effect of dialect === 'mysql' ? ['rejected', 'altered'] : ['rejected', 'suppressed', 'altered']) {
      await check(`legacy=${legacy}: ${effect} storage preserves the previous challenge`, async () => {
        const before = await rows()
        if (dialect === 'postgres') {
          const body = effect === 'rejected' ? "RAISE EXCEPTION 'fixture write denied';" : effect === 'suppressed' ? 'RETURN NULL;' : "NEW.challenge := 'altered'; RETURN NEW;"
          await db.unsafe(`CREATE FUNCTION alter_challenge() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${body} END; $$`).execute()
          await db.unsafe('CREATE TRIGGER alter_challenge BEFORE INSERT ON webauthn_challenges FOR EACH ROW EXECUTE FUNCTION alter_challenge()').execute()
        }
        else if (dialect === 'mysql') {
          const body = effect === 'rejected' ? "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture write denied'" : "SET NEW.challenge = 'altered'"
          await db.unsafe(`CREATE TRIGGER alter_challenge BEFORE INSERT ON webauthn_challenges FOR EACH ROW ${body}`).execute()
        }
        else {
          const body = effect === 'rejected' ? "SELECT RAISE(ABORT, 'fixture write denied')" : effect === 'suppressed' ? 'SELECT RAISE(IGNORE)' : "UPDATE webauthn_challenges SET challenge = 'altered' WHERE id = NEW.id"
          await db.unsafe(`CREATE TRIGGER alter_challenge ${effect === 'altered' ? 'AFTER' : 'BEFORE'} INSERT ON webauthn_challenges BEGIN ${body}; END`).execute()
        }
        try {
          await assert.rejects(storeWebAuthnChallenge(1, next, 'authentication'))
          assert.deepEqual(await rows(), before, 'failed replacement must not destroy the prior challenge or bystanders')
        }
        finally {
          await db.unsafe(`DROP TRIGGER alter_challenge${dialect === 'postgres' ? ' ON webauthn_challenges' : ''}`).execute()
          if (dialect === 'postgres') await db.unsafe('DROP FUNCTION alter_challenge()').execute()
        }
      })
    }
    await check(`legacy=${legacy}: outer rollback restores the prior challenge`, async () => {
      const before = await rows()
      await assert.rejects(db.transaction(async () => {
        await storeWebAuthnChallenge(1, next, 'authentication')
        throw new Error('fixture rollback')
      }), /fixture rollback/)
      assert.deepEqual(await rows(), before)
    })
    await check(`legacy=${legacy}: replacement preserves owner and purpose boundaries`, async () => {
      await storeWebAuthnChallenge(1, next, 'authentication')
      assert.deepEqual(await consumeWebAuthnChallenge(1, 'authentication'), Buffer.from(next))
      assert.equal(await consumeWebAuthnChallenge(1, 'authentication'), null)
      const remaining = await rows()
      assert.equal(remaining.length, 2)
      assert(remaining.some(row => row.challenge === 'same-owner-other-purpose'))
      assert(remaining.some(row => row.challenge === 'other-owner'))
      const encoded = Buffer.from([1, 2, 3]).toString('base64url')
      await storeWebAuthnChallenge(1, encoded, 'authentication')
      assert.deepEqual(await consumeWebAuthnChallenge(1, 'authentication'), Buffer.from([1, 2, 3]))
    })
  }
  assert.deepEqual(failures, [])
  console.log('passkey storage atomicity OK')
}
finally { await closeDatabaseConnection() }
