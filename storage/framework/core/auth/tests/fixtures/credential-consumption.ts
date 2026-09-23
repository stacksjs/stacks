import assert from 'node:assert/strict'
import { setSystemTime } from 'bun:test'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_CREDENTIAL_TEST_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-credential-test-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_credential_test_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
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
const { createTwoFactorChallenge, consumeTwoFactorChallenge, stashPendingTwoFactorSecret, consumePendingTwoFactorSecret, verifyTwoFactorLoginCode } = await import('../../src/two-factor')
const { generateTwoFactorSecret, generateTwoFactorToken } = await import('../../src/authenticator')
const { storeWebAuthnChallenge, consumeWebAuthnChallenge } = await import('../../src/passkey')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { registerPersistentQueryHooks } = await import('@stacksjs/query-builder')
const failures: string[] = []

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY)').execute()
  await ensureFrameworkAuthTables()
  const now = new Date('2030-01-02T03:04:05.000Z')
  setSystemTime(now)
  for (const mode of ['login', 'pending', 'webauthn'] as const) {
    const setup = async (ttl: number) => {
      if (mode === 'login') {
        const token = await createTwoFactorChallenge(1, ttl)
        return () => consumeTwoFactorChallenge(token)
      }
      if (mode === 'pending') {
        await stashPendingTwoFactorSecret(1, 'synthetic-pending-secret', ttl)
        return () => consumePendingTwoFactorSecret(1)
      }
      await storeWebAuthnChallenge(1, new Uint8Array([1, 2, 3]), 'authentication', ttl)
      return () => consumeWebAuthnChallenge(1, 'authentication')
    }
    for (const ttl of [-1, 0, 1]) {
      try {
        const consume = await setup(ttl)
        assert.equal(await consume() !== null, ttl > 0, `${mode}: credential TTL ${ttl} boundary`)
        assert.equal(await consume(), null, `${mode}: sequential consumption must be single-use`)
      }
      catch (error) { failures.push(String(error)) }
    }
    try {
      const consume = await setup(60)
      const results = await Promise.all(Array.from({ length: 8 }, () => consume()))
      assert.equal(results.filter(result => result !== null).length, 1, `${mode}: exactly one concurrent consumer may win`)
    }
    catch (error) { failures.push(String(error)) }

    if (dialect === 'sqlite') {
      const { Database } = await import('bun:sqlite')
      const contender = new Database(process.env.DB_DATABASE_PATH!)
      const consume = await setup(60)
      const table = mode === 'login' ? 'two_factor_challenges' : mode === 'pending' ? 'two_factor_pending_secrets' : 'webauthn_challenges'
      let claimed = false
      const unregister = registerPersistentQueryHooks({ onQueryStart(event) {
        if (event.kind === 'delete' && event.sql.includes(table))
          claimed = contender.query(`DELETE FROM ${table} WHERE user_id = 1`).run().changes === 1
      } })
      try {
        const result = await consume()
        assert(claimed, 'the competing connection must consume between SELECT and DELETE')
        assert.equal(result, null, `${mode}: a zero-row delete cannot claim a credential`)
      }
      catch (error) { failures.push(String(error)) }
      finally { unregister() }
      if (mode !== 'login') {
        const staleConsume = await setup(60)
        const column = mode === 'pending' ? 'secret' : 'challenge'
        const replacement = mode === 'pending' ? 'synthetic-replacement' : Buffer.from([4, 5, 6]).toString('base64url')
        let replaced = false
        const stop = registerPersistentQueryHooks({ onQueryStart(event) {
          if (event.kind === 'delete' && event.sql.includes(table))
            replaced = contender.query(`UPDATE ${table} SET ${column} = ? WHERE user_id = 1`).run(replacement).changes === 1
        } })
        try {
          assert.equal(await staleConsume(), null, `${mode}: a stale consumer must not claim a replacement`)
          assert(replaced)
        }
        catch (error) { failures.push(String(error)) }
        finally { stop() }
        try {
          const current = await staleConsume()
          assert.equal(mode === 'pending' ? current : Buffer.from(current as Uint8Array).toString('base64url'), replacement, `${mode}: replacement must remain available`)
        }
        catch (error) { failures.push(String(error)) }
      }
      contender.close()
    }
  }
  const secret = generateTwoFactorSecret()
  const code = await generateTwoFactorToken(secret)
  const resetTotp = async () => {
    await db.deleteFrom('users').where('id', '=', 1).execute()
    await db.insertInto('users').values({ id: 1, two_factor_secret: secret, two_factor_enabled: true } as never).execute()
  }
  await resetTotp()
  try {
    const results = await Promise.all(Array.from({ length: 8 }, () => verifyTwoFactorLoginCode(1, code)))
    assert.equal(results.filter(Boolean).length, 1, 'TOTP: exactly one concurrent verifier may consume a step')
    assert.equal(await verifyTwoFactorLoginCode(1, code), false, 'TOTP: sequential replay must fail')
    setSystemTime(new Date(now.getTime() + 30_000))
    const nextCode = await generateTwoFactorToken(secret)
    assert.equal(await verifyTwoFactorLoginCode(1, nextCode), true, 'TOTP: the next time step must remain usable')
    assert.equal(await verifyTwoFactorLoginCode(1, nextCode), false, 'TOTP: the next step is also single-use')
  }
  catch (error) { failures.push(String(error)) }
  finally { setSystemTime(now) }

  await resetTotp()
  await db.unsafe('ALTER TABLE users RENAME COLUMN two_factor_last_used_step TO hidden_totp_step').execute()
  try {
    await assert.rejects(() => verifyTwoFactorLoginCode(1, code), /two_factor_last_used_step/i, 'TOTP: missing replay schema must fail closed')
  }
  catch (error) { failures.push(String(error)) }
  finally { await db.unsafe('ALTER TABLE users RENAME COLUMN hidden_totp_step TO two_factor_last_used_step').execute() }

  if (dialect === 'sqlite') {
    const { Database } = await import('bun:sqlite')
    const contender = new Database(process.env.DB_DATABASE_PATH!)
    try {
      for (const change of [
        'UPDATE users SET two_factor_last_used_step = 9999999999 WHERE id = 1',
        'UPDATE users SET two_factor_enabled = 0 WHERE id = 1',
        "UPDATE users SET two_factor_secret = 'DIFFERENTSECRET' WHERE id = 1",
        'DELETE FROM users WHERE id = 1',
      ]) {
        await resetTotp()
        let changed = false
        const stop = registerPersistentQueryHooks({ onQueryStart(event) {
          if (event.kind === 'update' && event.sql.includes('two_factor_last_used_step')) {
            contender.exec(change)
            changed = true
          }
        } })
        try {
          assert.equal(await verifyTwoFactorLoginCode(1, code), false, `TOTP: stale verifier cannot override ${change}`)
          assert(changed, 'a competing connection must change state before the claim')
        }
        catch (error) { failures.push(String(error)) }
        finally { stop() }
      }
      await resetTotp()
      contender.exec("CREATE TRIGGER reject_totp_claim BEFORE UPDATE OF two_factor_last_used_step ON users BEGIN SELECT RAISE(ABORT, 'synthetic claim failure'); END")
      try {
        await assert.rejects(() => verifyTwoFactorLoginCode(1, code), /synthetic claim failure/, 'TOTP: a failed persistence write must never authorize')
      }
      catch (error) { failures.push(String(error)) }
      finally { contender.exec('DROP TRIGGER reject_totp_claim') }
    }
    finally { contender.close() }
  }
  assert.deepEqual(failures, [])
  console.log('credential consumption OK')
}
finally {
  setSystemTime()
  await closeDatabaseConnection()
}
