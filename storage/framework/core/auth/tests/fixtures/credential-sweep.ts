/**
 * The shared credential sweep (revokeAccountCredentials), changePassword, the
 * revokeOtherTokens fail-closed rule, and the password-reset `deliver` /
 * `expiresAt` / `purpose` options, against real SQLite.
 * Spawned by credential-sweep.test.ts.
 */
import assert from 'node:assert/strict'

const database = process.env.DB_DATABASE_PATH
assert(database)

const { overridesReady } = await import('@stacksjs/config')
await overridesReady.catch(() => undefined)
const { closeDatabaseConnection, db, ensureDatabaseConfigLoaded, initializeDbConfig, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } } })
const { configureOrm, releaseOrm } = await import('bun-query-builder')
configureOrm({ database })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { makeHash, verifyHash } = await import('@stacksjs/security')
const { createToken, findToken, validateRefreshToken, revokeOtherTokens } = await import('../../src/tokens')
const { Auth } = await import('../../src/authentication')
const { changePassword, passwordResets, revokeAccountCredentials } = await import('../../src/password/reset')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')

const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try {
    await run()
    console.log(`PASS ${name}`)
  }
  catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.stack : error}`)
  }
}

async function live(pair: Awaited<ReturnType<typeof createToken>>): Promise<boolean> {
  const access = Boolean(await findToken(pair.plainTextToken))
  const refresh = await validateRefreshToken(pair.refreshToken!)
  assert.equal(access, refresh, 'an access token and its refresh token live and die together')
  return access
}

/** Issue a pair an hour in the past, so the stamp is strictly after it. */
async function oldPair(name: string) {
  const pair = await createToken(42, name, ['*'])
  const past = sqlDateTime(new Date(Date.now() - 60 * 60_000))
  await db.updateTable('oauth_access_tokens').set({ created_at: past } as never).where('id', '=', pair.accessToken.id).execute()
  await db.updateTable('oauth_refresh_tokens').set({ created_at: past } as never).where('access_token_id', '=', pair.accessToken.id).execute()
  return pair
}

async function resetUser(password: string) {
  await db.deleteFrom('oauth_refresh_tokens').execute()
  await db.deleteFrom('oauth_access_tokens').execute()
  await db.deleteFrom('sessions').execute()
  await db.updateTable('users').set({ password: await makeHash(password, { algorithm: 'bcrypt' }), password_changed_at: null } as never).where('id', '=', 42).execute()
  const now = Math.floor(Date.now() / 1000)
  const expires = sqlDateTime(new Date(Date.now() + 60 * 60_000))
  await db.insertInto('sessions').values([
    { id: 'kept-session', user_id: 42, payload: '', last_activity: now, expires_at: expires },
    { id: 'other-session', user_id: 42, payload: '', last_activity: now, expires_at: expires },
  ] as never).execute()
}

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email VARCHAR(255) UNIQUE, password TEXT, email_verified_at TIMESTAMP, password_changed_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  await db.unsafe('CREATE TABLE sessions (id VARCHAR(255) PRIMARY KEY, user_id INTEGER, ip_address TEXT, user_agent TEXT, payload TEXT, last_activity INTEGER, expires_at TIMESTAMP)').execute()
  await db.insertInto('users').values({ id: 42, name: 'Ada', email: 'ada@example.com', password: 'x', created_at: sqlDateTime() } as never).execute()
  await ensureFrameworkAuthTables()

  await check('changePassword refuses a wrong current password and revokes nothing', async () => {
    await resetUser('old-password')
    const pair = await oldPair('phone')
    const result = await changePassword(42, 'not-it', 'new-password', { notify: false })
    assert.deepEqual(result, { success: false, reason: 'invalid-current-password' })
    assert.equal(await live(pair), true)
    const user = await db.selectFrom('users').selectAll().where('id', '=', 42).executeTakeFirstOrThrow()
    assert.equal(user.password_changed_at, null)
  })

  await check('changePassword keeps the caller signed in and sweeps everything else', async () => {
    await resetUser('old-password')
    const current = await oldPair('this-browser')
    const other = await oldPair('attacker')
    const notified: unknown[] = []

    const result = await changePassword(42, 'old-password', 'new-password', {
      keepTokenId: current.accessToken.id,
      keepSessionId: 'kept-session',
      notify: recipient => void notified.push(recipient),
    })
    assert.deepEqual(result, { success: true, keptTokenId: current.accessToken.id })

    const user = await db.selectFrom('users').selectAll().where('id', '=', 42).executeTakeFirstOrThrow()
    assert.ok(user.password_changed_at, 'password_changed_at is stamped')
    assert.ok(await verifyHash('new-password', String(user.password)))
    // The kept pair is re-bound to the stamp, so it outlives it; the other is dead.
    assert.equal(await live(current), true)
    assert.equal(await live(other), false)
    const sessions = await db.selectFrom('sessions').select(['id']).execute()
    assert.deepEqual(sessions.map(row => row.id), ['kept-session'])
    await Bun.sleep(10)
    assert.deepEqual(notified, [{ id: 42, email: 'ada@example.com', name: 'Ada' }])
  })

  await check('revokeAccountCredentials with nothing kept signs out everywhere', async () => {
    await resetUser('pw')
    const a = await oldPair('a')
    const b = await oldPair('b')
    const result = await revokeAccountCredentials(42)
    assert.equal(result.keptTokenId, null)
    assert.ok(result.passwordChangedAt instanceof Date)
    assert.equal(await live(a), false)
    assert.equal(await live(b), false)
    assert.equal((await db.selectFrom('sessions').select(['id']).execute()).length, 0)
  })

  await check('revokeAccountCredentials joins the caller\'s transaction and rolls back with it', async () => {
    await resetUser('pw')
    const pair = await oldPair('a')
    await assert.rejects(db.transaction(async (tx) => {
      await revokeAccountCredentials(42, { tx })
      throw new Error('caller rolls back')
    }), /caller rolls back/)
    assert.equal(await live(pair), true)
    const user = await db.selectFrom('users').selectAll().where('id', '=', 42).executeTakeFirstOrThrow()
    assert.equal(user.password_changed_at, null)
  })

  await check('revokeAccountCredentials refuses a tx outside its transaction', async () => {
    await assert.rejects(revokeAccountCredentials(42, { tx: {} }), TypeError)
    await assert.rejects(revokeAccountCredentials(0), TypeError)
  })

  await check('revokeOtherTokens fails closed when no current token resolves', async () => {
    await resetUser('pw')
    for (const revoke of [() => revokeOtherTokens(42), () => Auth.revokeOtherTokens(42)]) {
      const a = await createToken(42, 'a', ['*'])
      const b = await createToken(42, 'b', ['*'])
      const result = await revoke()
      assert.deepEqual(result, { keptTokenId: null })
      assert.equal(await live(a), false)
      assert.equal(await live(b), false)
    }
  })

  await check('revokeOtherTokens keeps an explicit token', async () => {
    await resetUser('pw')
    const keep = await createToken(42, 'keep', ['*'])
    const drop = await createToken(42, 'drop', ['*'])
    assert.deepEqual(await Auth.revokeOtherTokens(42, { exceptTokenId: keep.accessToken.id }), { keptTokenId: keep.accessToken.id })
    assert.equal(await live(keep), true)
    assert.equal(await live(drop), false)
  })

  await check('password reset: deliver hook, explicit expiry and the setup purpose', async () => {
    await resetUser('pw')
    await db.deleteFrom('password_resets').execute()
    const pair = await oldPair('before-setup')
    const deliveries: any[] = []
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60_000)
    await passwordResets('ADA@example.com').sendEmail({
      purpose: 'setup',
      expiresAt,
      deliver: delivery => void deliveries.push(delivery),
    })
    assert.equal(deliveries.length, 1)
    const [delivery] = deliveries
    assert.equal(delivery.purpose, 'setup')
    assert.equal(delivery.userId, 42)
    assert.equal(delivery.email, 'ada@example.com')
    assert.match(delivery.token, /^[a-f0-9]{64}$/)
    assert.ok(String(delivery.url).includes(delivery.token))
    assert.equal(Math.floor(delivery.expiresAt.getTime() / 1000), Math.floor(expiresAt.getTime() / 1000))
    const row = await db.selectFrom('password_resets').selectAll().executeTakeFirstOrThrow()
    assert.equal(row.expires_at, sqlDateTime(expiresAt))

    await assert.rejects(passwordResets('ada@example.com').sendEmail({ expiresAt: new Date(Date.now() - 1000) }), TypeError)

    const reset = await passwordResets('ada@example.com').resetPassword(delivery.token, 'chosen-password')
    assert.deepEqual(reset, { success: true })
    assert.equal(await live(pair), false, 'the reset runs the same sweep')
    const user = await db.selectFrom('users').selectAll().where('id', '=', 42).executeTakeFirstOrThrow()
    assert.ok(user.password_changed_at)
    assert.ok(await verifyHash('chosen-password', String(user.password)))
  })

  if (failures.length > 0) {
    console.error(failures.join('\n\n'))
    process.exitCode = 1
  }
  else {
    console.log('credential sweep OK')
  }
}
finally {
  releaseOrm()
  await closeDatabaseConnection()
}
