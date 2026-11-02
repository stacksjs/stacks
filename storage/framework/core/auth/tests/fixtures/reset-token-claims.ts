import assert from 'node:assert/strict'
import { overridesReady } from '@stacksjs/config'
import { db, ensureDatabaseConfigLoaded, initializeDbConfig, closeDatabaseConnection } from '@stacksjs/database/runtime'
import { consumePasswordResetToken, mintPasswordResetToken } from '../../src/password/reset-token'

await overridesReady
await ensureDatabaseConfigLoaded()
const dialect = process.env.DB_CONNECTION === 'postgres' ? 'postgres' : 'sqlite'
assert(process.env.DB_DATABASE?.startsWith('stacks_claim_') || process.env.DB_DATABASE_PATH?.includes('stacks_claim_'))
initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: {
  sqlite: { database: process.env.DB_DATABASE_PATH },
  postgres: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
}, queryLogging: { enabled: false } } })
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, password TEXT)').execute()
  await db.unsafe('CREATE TABLE password_resets (email TEXT UNIQUE, token TEXT, created_at TEXT, expires_at TEXT)').execute()
  await db.insertInto('users').values({ id: 1, email: 'claim@example.invalid', password: 'before' }).execute()
  const mint = async (expiresAt: string | null = null) => {
    const credential = mintPasswordResetToken()
    await db.deleteFrom('password_resets').execute()
    await db.insertInto('password_resets').values({ email: 'claim@example.invalid', token: credential.digest, created_at: new Date().toISOString(), expires_at: expiresAt }).execute()
    return credential.token
  }
  const token = await mint()
  const outcomes = await Promise.all(Array.from({ length: 4 }, (_, index) => consumePasswordResetToken(token, async (claim) => {
    assert.equal(claim.userId, 1)
    await db.updateTable('users').set({ password: `winner-${index}` }).where('id', '=', claim.userId).execute()
    return index
  })))
  assert.equal(outcomes.filter(outcome => outcome.consumed).length, 1)
  const retryable = await mint()
  await assert.rejects(() => consumePasswordResetToken(retryable, async () => {
    await db.updateTable('users').set({ password: 'rolled-back' }).where('id', '=', 1).execute()
    throw new Error('revocation failed')
  }), /revocation failed/)
  assert.notEqual((await db.selectFrom('users').select('password').executeTakeFirst())?.password, 'rolled-back')
  assert.equal((await consumePasswordResetToken(retryable, async () => 'retried')).consumed, true)
  const expired = await mint(new Date(Date.now() - 1).toISOString())
  assert.equal((await consumePasswordResetToken(expired, async () => assert.fail('expired callback'))).consumed, false)
  const replaced = await mint()
  const current = await mint()
  assert.equal((await consumePasswordResetToken(replaced, async () => assert.fail('replaced callback'))).consumed, false)
  const setup = await consumePasswordResetToken(current, async claim => claim.setup)
  assert.deepEqual(setup, { consumed: true, value: false })
  const invitation = await mint(new Date(Date.now() + 60_000).toISOString())
  assert.deepEqual(await consumePasswordResetToken(invitation, async claim => claim.setup), { consumed: true, value: true })
  const invalid = await mint('invalid')
  assert.equal((await consumePasswordResetToken(invalid, async () => assert.fail('invalid expiry'))).consumed, false)
  console.log('reset token claims OK')
}
finally { await closeDatabaseConnection() }
