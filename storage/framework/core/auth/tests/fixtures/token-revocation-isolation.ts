import assert from 'node:assert/strict'
import { SQL } from 'bun'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'mysql' || dialect === 'postgres')
assert.equal(process.env.DB_DATABASE_PATH, ':memory:', 'Use only a disposable fixture')
if (dialect !== 'sqlite') {
  assert(process.env.DB_DATABASE?.startsWith('stacks_token_test_'))
  assert(['localhost', '127.0.0.1', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: ':memory:' } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  },
  queryLogging: { enabled: false },
} })
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { createToken, revokeAllTokens, revokeOtherTokens, validateRefreshToken, refreshToken, findToken } = await import('../../src/tokens')
const { Auth } = await import('../../src/authentication')
const { enhanceRequest } = await import('@stacksjs/router')
const { runWithRequest, setAmbientRequestContext } = await import('../../../router/src/request-context')
setAmbientRequestContext(true)
const failures: string[] = []
async function assertPairLive(pair: Awaited<ReturnType<typeof createToken>>, live: boolean): Promise<void> {
  assert.equal(Boolean(await findToken(pair.plainTextToken)), live, 'Access token state')
  assert.equal(await validateRefreshToken(pair.refreshToken!), live, 'Refresh token state')
}
async function check(name: string, fn: () => Promise<void>) {
  await db.deleteFrom('oauth_refresh_tokens').execute()
  await db.deleteFrom('oauth_access_tokens').execute()
  Auth.clearState()
  try { await fn(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, password_changed_at TIMESTAMP)').execute()
  await db.insertInto('users').values({ id: 42 }).execute()
  await ensureFrameworkAuthTables()
  await check('revokeAllTokens preserves the requested owner type', async () => {
    const user = await createToken(42, 'user', ['*'])
    const author = await createToken(42, 'author', ['*'], { tokenableType: 'authors' })
    await revokeAllTokens(42, 'authors')
    await assertPairLive(author, false)
    await assertPairLive(user, true)
  })
  await check('revokeOtherTokens without a request keeps owner scope', async () => {
    const user = await createToken(42, 'user', ['*'])
    const author = await createToken(42, 'author', ['*'], { tokenableType: 'authors' })
    await revokeOtherTokens(42, 'authors')
    await assertPairLive(author, false)
    await assertPairLive(user, true)
  })
  await check('revokeOtherTokens keeps the current pair and revokes the other pair', async () => {
    for (const tokenableType of ['users', 'authors']) {
      const current = await createToken(42, 'current', ['*'], { tokenableType })
      const other = await createToken(42, 'other', ['*'], { tokenableType })
      const unrelated = await createToken(43, 'different-id', ['*'], { tokenableType })
      const otherOwner = await createToken(42, 'different-type', ['*'], { tokenableType: 'guests' })
      const request = enhanceRequest(new Request('https://revocation.test/', { headers: { authorization: `Bearer ${current.plainTextToken}` } }))
      await runWithRequest(request, () => revokeOtherTokens(42, tokenableType))
      await assertPairLive(other, false)
      await assertPairLive(current, true)
      await assertPairLive(unrelated, true)
      await assertPairLive(otherOwner, true)
    }
  })
  await check('Auth.revokeOtherTokens revokes the paired refresh token', async () => {
    const current = await createToken(42, 'current', ['*'])
    const other = await createToken(42, 'other', ['*'])
    const unrelated = await createToken(43, 'different-id', ['*'])
    const otherOwner = await createToken(42, 'different-type', ['*'], { tokenableType: 'authors' })
    const request = enhanceRequest(new Request('https://revocation.test/', { headers: { authorization: `Bearer ${current.plainTextToken}` } }))
    await runWithRequest(request, () => Auth.revokeOtherTokens(42))
    await assertPairLive(other, false)
    await assertPairLive(current, true)
    await assertPairLive(unrelated, true)
    await assertPairLive(otherOwner, true)
  })
  await check('concurrent refresh exchanges permit only one winner', async () => {
    const original = await createToken(42, 'rotate-once', ['*'])
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => refreshToken(original.refreshToken!)))
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(await validateRefreshToken(original.refreshToken!), false)
  })
  await check('bulk revocation handles more than one parameter batch', async () => {
    const pairs = []
    for (let index = 0; index < 105; index++)
      pairs.push(await createToken(42, `bulk-${index}`, ['*']))
    await Auth.revokeAllTokens(42)
    const live = await db.selectFrom('oauth_access_tokens').where('revoked', '=', false).get()
    assert.equal(live.length, 0)
    for (const pair of [pairs[0]!, pairs[99]!, pairs[100]!, pairs[104]!])
      await assertPairLive(pair, false)
  })
  if (dialect === 'sqlite') {
    await check('a failed access-token update rolls back the refresh cascade', async () => {
      const pair = await createToken(42, 'rollback-pair', ['*'])
      await db.unsafe("CREATE TRIGGER reject_bulk_revoke BEFORE UPDATE ON oauth_access_tokens BEGIN SELECT RAISE(ABORT, 'fixture revocation denied'); END").execute()
      try {
        await assert.rejects(revokeAllTokens(42), /fixture revocation denied/)
        await assertPairLive(pair, true)
      }
      finally { await db.unsafe('DROP TRIGGER reject_bulk_revoke').execute() }
    })
  }
  if (dialect === 'postgres') {
    await check('bulk revocation follows the configured database without DB_CONNECTION', async () => {
      const pair = await createToken(42, 'configured-postgres', ['*'])
      // Connection setup above selected Postgres explicitly. Environment is
      // not the authority once initializeDbConfig has selected a database.
      delete process.env.DB_CONNECTION
      try { await Auth.revokeAllTokens(42) }
      finally { process.env.DB_CONNECTION = dialect }
      await assertPairLive(pair, false)
    })
    await check('a refresh racing sign-out cannot leave a replacement credential live', async () => {
      const current = await createToken(42, 'current', ['*'])
      const other = await createToken(42, 'rotating-other', ['*'])
      const observer = new SQL({ adapter: 'postgres', hostname: process.env.DB_HOST,
        port: Number(process.env.DB_PORT), database: process.env.DB_DATABASE,
        username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD })
      const blocker = await observer.reserve()
      let held = false
      let rotating: Promise<PromiseSettledResult<Awaited<ReturnType<typeof refreshToken>>>> | undefined
      let revoking: Promise<PromiseSettledResult<void>> | undefined
      const settled = <T>(promise: Promise<T>) => promise.then(
        value => ({ status: 'fulfilled' as const, value }),
        reason => ({ status: 'rejected' as const, reason }),
      )
      async function waitForBlocked(count: number): Promise<void> {
        const deadline = Date.now() + 5000
        while (Date.now() < deadline) {
          const rows = await observer.unsafe("SELECT COUNT(*) AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'")
          if (Number(rows[0].count) >= count) return
          await Bun.sleep(10)
        }
        throw new Error(`Expected ${count} blocked fixture operations before releasing the lock`)
      }
      try {
        await blocker.unsafe('BEGIN')
        held = true
        await blocker.unsafe('UPDATE oauth_refresh_tokens SET revoked = revoked WHERE access_token_id = $1', [other.accessToken.id])
        rotating = settled(refreshToken(other.refreshToken!))
        await waitForBlocked(1)
        const request = enhanceRequest(new Request('https://revocation.test/', { headers: { authorization: `Bearer ${current.plainTextToken}` } }))
        revoking = settled(runWithRequest(request, () => Auth.revokeOtherTokens(42)))
        await waitForBlocked(2)
        await blocker.unsafe('COMMIT')
        held = false
        const [rotation, revocation] = await Promise.all([rotating, revoking])
        assert.equal(revocation.status, 'fulfilled', 'Sign-out must complete after any lock retry')
        if (rotation.status === 'fulfilled')
          await assertPairLive(rotation.value, false)
        await assertPairLive(other, false)
        await assertPairLive(current, true)
      }
      finally {
        if (held) await blocker.unsafe('ROLLBACK')
        await Promise.all([rotating, revoking])
        blocker.release()
        await observer.close()
      }
    })
  }
}
finally {
  resetDatabaseConnection()
}
assert.deepEqual(failures, [], failures.join('\n'))
console.log('token revocation isolation OK')
