import assert from 'node:assert/strict'
import { overridesReady } from '@stacksjs/config'
import { db, ensureDatabaseConfigLoaded, initializeDbConfig, closeDatabaseConnection } from '@stacksjs/database/runtime'
import { consumePasswordResetToken, issuePasswordResetToken, mintPasswordResetToken } from '../../src/password/reset-token'

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
  await db.insertInto('users').values({ id: 1, email: 'Claim@Example.invalid', password: 'before' }).execute()
  const issued = await Promise.all(Array.from({ length: 4 }, () => issuePasswordResetToken(' CLAIM@example.invalid ', { throttleMs: 60000 })))
  const winner = issued.find(result => result.issued)
  assert.equal(issued.filter(result => result.issued).length, 1)
  assert(winner?.issued)
  assert.equal((await consumePasswordResetToken(winner.token, async claim => claim.userId)).consumed, true)
  assert.deepEqual(await issuePasswordResetToken('claim@example.invalid', { eligible: () => false }), { issued: false })
  assert.equal((await db.selectFrom('password_resets').select('email').execute()).length, 0)
  await assert.rejects(issuePasswordResetToken('claim@example.invalid', { throttleMs: Number.NaN }), RangeError)
  await assert.rejects(issuePasswordResetToken('claim@example.invalid', { expiresAt: new Date(Date.now() - 1) }), RangeError)
  const legacy = mintPasswordResetToken()
  await db.insertInto('password_resets').values({ email: 'Claim@Example.invalid', token: legacy.digest, created_at: new Date(Date.now() - 120_000).toISOString() }).execute()
  await assert.rejects(() => consumePasswordResetToken(legacy.token, async () => { throw new Error('legacy credential valid before replacement') }), /legacy credential valid before replacement/)
  const replacement = await issuePasswordResetToken('claim@example.invalid', { throttleMs: 60_000 })
  assert(replacement.issued)
  assert.deepEqual(await consumePasswordResetToken(legacy.token, async () => 'stale legacy credential'), { consumed: false }, 'replacement retires every case variant')
  assert.equal((await consumePasswordResetToken(replacement.token, async claim => claim.userId)).consumed, true)

  const recentLegacy = mintPasswordResetToken()
  const olderCanonical = mintPasswordResetToken()
  await db.insertInto('password_resets').values([
    { email: 'Claim@Example.invalid', token: recentLegacy.digest, created_at: new Date().toISOString() },
    { email: 'claim@example.invalid', token: olderCanonical.digest, created_at: new Date(Date.now() - 120_000).toISOString() },
  ]).execute()
  assert.deepEqual(await issuePasswordResetToken('CLAIM@example.invalid', { throttleMs: 60_000 }), { issued: false }, 'the newest case variant governs throttling')
  assert.equal((await consumePasswordResetToken(recentLegacy.token, async claim => claim.userId)).consumed, true, 'throttling preserves the existing credential')
  await db.deleteFrom('password_resets').execute()

  const futureStamped = mintPasswordResetToken()
  await db.insertInto('password_resets').values({ email: 'claim@example.invalid', token: futureStamped.digest, created_at: new Date(Date.now() + 60_000).toISOString() }).execute()
  const unthrottled = await issuePasswordResetToken('claim@example.invalid', { throttleMs: 0 })
  assert(unthrottled.issued, 'zero throttle disables throttling even for a future saved timestamp')
  assert.deepEqual(await consumePasswordResetToken(futureStamped.token, async () => 'old future credential'), { consumed: false })
  assert.equal((await consumePasswordResetToken(unthrottled.token, async claim => claim.userId)).consumed, true)

  const transferred = await issuePasswordResetToken('claim@example.invalid')
  assert(transferred.issued)
  await db.updateTable('users').set({ email: 'moved@example.invalid' }).where('id', '=', 1).execute()
  await db.insertInto('users').values({ id: 2, email: 'claim@example.invalid', password: 'successor' }).execute()
  assert.deepEqual(await consumePasswordResetToken(transferred.token, async () => assert.fail('the old address holder cannot reset its successor')), { consumed: false })
  await db.deleteFrom('users').where('id', '=', 2).execute()
  await db.updateTable('users').set({ email: 'claim@example.invalid' }).where('id', '=', 1).execute()
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
  const setup = await consumePasswordResetToken(current, async claim => claim.hasExplicitExpiry)
  assert.deepEqual(setup, { consumed: true, value: false })
  const invitation = await mint(new Date(Date.now() + 60_000).toISOString())
  assert.deepEqual(await consumePasswordResetToken(invitation, async claim => claim.hasExplicitExpiry), { consumed: true, value: true })
  const invalid = await mint('invalid')
  assert.equal((await consumePasswordResetToken(invalid, async () => assert.fail('invalid expiry'))).consumed, false)
  console.log('reset token claims OK')
}
finally { await closeDatabaseConnection() }
