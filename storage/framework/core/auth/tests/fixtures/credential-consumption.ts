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
const { createTwoFactorChallenge, consumeTwoFactorChallenge, stashPendingTwoFactorSecret, consumePendingTwoFactorSecret } = await import('../../src/two-factor')
const { storeWebAuthnChallenge, consumeWebAuthnChallenge } = await import('../../src/passkey')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { registerPersistentQueryHooks } = await import('@stacksjs/query-builder')
const failures: string[] = []

try {
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
  assert.deepEqual(failures, [])
  console.log('credential consumption OK')
}
finally {
  setSystemTime()
  await closeDatabaseConnection()
}
