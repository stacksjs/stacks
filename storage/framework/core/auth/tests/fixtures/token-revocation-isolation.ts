import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { SQL } from 'bun'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'mysql' || dialect === 'postgres')
if (dialect === 'sqlite') {
  assert(process.env.DB_DATABASE_PATH && basename(dirname(process.env.DB_DATABASE_PATH)).startsWith('stacks-token-test-'))
}
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:', 'Use only a disposable fixture')
  assert(process.env.DB_DATABASE?.startsWith('stacks_token_test_'))
  assert(['localhost', '127.0.0.1', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection, withRoutingContext, shouldRouteToReplica } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  },
  queryLogging: { enabled: false },
} })
const { configureOrm, releaseOrm } = await import('bun-query-builder')
if (dialect === 'sqlite') configureOrm({ database: process.env.DB_DATABASE_PATH })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { createToken, revokeToken, revokeTokenById, revokeAllTokens, revokeOtherTokens, validateRefreshToken, refreshToken, findToken, currentAccessToken, tokenCan, tokenCant, tokenCanAll, tokenCanAny, tokenAbilities, createClient, revokeClient } = await import('../../src/tokens')
const { Auth } = await import('../../src/authentication')
const { authCookie, logoutCookie } = await import('../../src/cookie-auth')
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
  for (const mode of ['raw', 'raw-id', 'auth', 'auth-id', 'cookie'] as const) {
    for (const rejectedTable of ['oauth_access_tokens', 'oauth_refresh_tokens']) {
      await check(`${mode}: individual revocation rolls back a failed ${rejectedTable} update`, async () => {
        const pair = await createToken(42, 'individual', ['*'])
        const other = await createToken(42, 'unrelated-session', ['*'])
        const options = { name: 'fixture-session', path: '/account', domain: 'fixture.test' }
        const revoke = async () => {
          if (mode === 'raw') return revokeToken(pair.plainTextToken)
          if (mode === 'raw-id') return revokeTokenById(Number(pair.accessToken.id))
          if (mode === 'auth') return Auth.revokeToken(pair.plainTextToken)
          if (mode === 'auth-id') return Auth.revokeTokenById(Number(pair.accessToken.id))
          return logoutCookie(new Request('https://fixture.test/account/logout', {
            headers: { cookie: authCookie(pair.plainTextToken, options).split(';')[0]! },
          }), options)
        }
        if (dialect === 'postgres') {
          await db.unsafe("CREATE FUNCTION reject_individual_revoke() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture individual revocation denied'; END; $$").execute()
          await db.unsafe(`CREATE TRIGGER reject_individual_revoke BEFORE UPDATE ON ${rejectedTable} FOR EACH ROW EXECUTE FUNCTION reject_individual_revoke()`).execute()
        }
        else if (dialect === 'mysql') {
          await db.unsafe(`CREATE TRIGGER reject_individual_revoke BEFORE UPDATE ON ${rejectedTable} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture individual revocation denied'`).execute()
        }
        else {
          await db.unsafe(`CREATE TRIGGER reject_individual_revoke BEFORE UPDATE ON ${rejectedTable} BEGIN SELECT RAISE(ABORT, 'fixture individual revocation denied'); END`).execute()
        }
        try {
          await assert.rejects(revoke(), /fixture individual revocation denied/)
          await assertPairLive(pair, true)
          await assertPairLive(other, true)
        }
        finally {
          await db.unsafe(`DROP TRIGGER reject_individual_revoke${dialect === 'postgres' ? ` ON ${rejectedTable}` : ''}`).execute()
          if (dialect === 'postgres') await db.unsafe('DROP FUNCTION reject_individual_revoke()').execute()
        }
        const cleared = await withRoutingContext(async () => {
          const routing = { replicas: [{ host: '127.0.0.1' }], policy: { autoRoute: true } }
          assert.equal(shouldRouteToReplica(routing), true)
          const result = await revoke()
          assert.equal(shouldRouteToReplica(routing), false, 'Post-logout reads must stay on the primary in the writing request')
          return result
        })
        await assertPairLive(pair, false)
        await assertPairLive(other, true)
        await assert.rejects(refreshToken(pair.refreshToken!), /Invalid or expired refresh token/)
        assert.equal(await revoke(), cleared, 'Repeated revocation is idempotent')
        if (mode === 'cookie') {
          assert.equal(typeof cleared, 'string')
          for (const attribute of ['fixture-session=', 'Path=/account', 'Domain=fixture.test', 'Max-Age=0'])
            assert(cleared!.includes(attribute))
        }
      })
    }
  }
  for (const mode of ['raw', 'auth', 'cookie'] as const) {
    await check(`${mode}: colon-bearing tokens preserve caller-specific hashing`, async () => {
      const prefix = await createToken(42, 'legacy-prefix', ['*'])
      const full = await createToken(42, 'full-bearer', ['*'])
      const bearer = `${prefix.plainTextToken}:fixture-suffix`
      // Model both historical at-rest hashes without mocking either lookup.
      await db.updateTable('oauth_access_tokens').set({ token: createHash('sha256').update(bearer).digest('hex') }).where('id', '=', full.accessToken.id).execute()
      if (mode === 'raw') await revokeToken(bearer)
      else if (mode === 'auth') await Auth.revokeToken(bearer)
      else await logoutCookie(new Request('https://fixture.test/logout', { headers: { cookie: authCookie(bearer).split(';')[0]! } }))
      for (const [pair, revoked] of [[prefix, mode === 'raw'], [full, mode !== 'raw']] as const) {
        const row = await db.selectFrom('oauth_access_tokens').where('id', '=', pair.accessToken.id).select('revoked').executeTakeFirst()
        assert.equal(Boolean(row?.revoked), revoked)
        assert.equal(await validateRefreshToken(pair.refreshToken!), !revoked)
      }
    })
  }
  await check('individual revocation accepts missing tokens and access-only tokens', async () => {
    await revokeToken('not-issued')
    await Auth.revokeToken('not-issued')
    await revokeTokenById(-1)
    await Auth.revokeTokenById(-1)
    const pair = await createToken(42, 'access-only', ['*'], { withRefreshToken: false })
    await revokeToken(pair.plainTextToken)
    assert.equal(await findToken(pair.plainTextToken), null)
  })
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
  for (const transport of ['bearer', 'cookie', 'both'] as const) {
    await check(`${transport}: standalone ability helpers resolve the current credential`, async () => {
      const current = await createToken(42, 'current', ['posts:read'])
      const different = await createToken(42, 'cookie-fallback', ['admin'])
      const headers = transport === 'bearer'
        ? { authorization: `Bearer ${current.plainTextToken}` }
        : transport === 'cookie'
          ? { cookie: authCookie(current.plainTextToken).split(';')[0]! }
          : { authorization: `Bearer ${current.plainTextToken}`, cookie: authCookie(different.plainTextToken).split(';')[0]! }
      const request = enhanceRequest(new Request('https://revocation.test/', { headers }))
      await runWithRequest(request, async () => {
        const active = await currentAccessToken()
        assert.equal(active?.id, current.accessToken.id)
        assert.equal(await currentAccessToken(), active, 'Resolved token remains cached on this request')
        assert.equal(await tokenCan('posts:read'), true)
        assert.equal(await tokenCant('posts:read'), false)
        assert.equal(await tokenCanAll(['posts:read']), true)
        assert.equal(await tokenCanAny(['posts:read', 'admin']), true)
        assert.equal(await tokenCan('admin'), false, 'The cookie cannot override an explicit bearer')
        assert.deepEqual(await tokenAbilities(), ['posts:read'])
      })
    })
    await check(`${transport}: revokeOtherTokens keeps the current pair and revokes the other pair`, async () => {
      for (const tokenableType of ['users', 'authors']) {
        const current = await createToken(42, 'current', ['*'], { tokenableType })
        const other = await createToken(42, 'other', ['*'], { tokenableType })
        const unrelated = await createToken(43, 'different-id', ['*'], { tokenableType })
        const otherOwner = await createToken(42, 'different-type', ['*'], { tokenableType: 'guests' })
        const headers = transport === 'bearer'
          ? { authorization: `Bearer ${current.plainTextToken}` }
          : transport === 'cookie'
            ? { cookie: authCookie(current.plainTextToken).split(';')[0]! }
            : { authorization: `Bearer ${current.plainTextToken}`, cookie: authCookie(other.plainTextToken).split(';')[0]! }
        const request = enhanceRequest(new Request('https://revocation.test/', { headers }))
        await runWithRequest(request, () => revokeOtherTokens(42, tokenableType))
        await assertPairLive(other, false)
        await assertPairLive(current, true)
        await assertPairLive(unrelated, true)
        await assertPairLive(otherOwner, true)
      }
    })
  }
  await check('an invalid bearer cannot fall back to a valid cookie', async () => {
    const valid = await createToken(42, 'cookie', ['*'])
    const request = enhanceRequest(new Request('https://revocation.test/', {
      headers: { authorization: 'Bearer not-issued', cookie: authCookie(valid.plainTextToken).split(';')[0]! },
    }))
    await runWithRequest(request, async () => {
      assert.equal(await currentAccessToken(), null)
      assert.equal(await tokenCan('posts:read'), false)
      assert.deepEqual(await tokenAbilities(), [])
    })
    await assertPairLive(valid, true)
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
  for (const method of ['user', 'validate', 'abilities-bearer', 'abilities-cookie', 'rotate', 'rotate-legacy'] as const) {
    await check(`${method}: another model's token cannot represent the same-id user`, async () => {
      const user = await createToken(42, 'user-session', ['read'])
      assert.equal(Number((await Auth.getUserFromToken(user.plainTextToken))?.id), 42)
      const author = await createToken(42, 'author-session', ['read'], { tokenableType: 'authors' })
      const before = await db.selectFrom('oauth_access_tokens').selectAll().orderBy('id').get()
      if (method === 'user')
        assert.equal((await Auth.getUserFromToken(author.plainTextToken))?.id, undefined)
      else if (method === 'validate')
        assert.equal(await Auth.validateToken(author.plainTextToken), false)
      else if (method === 'rotate' || method === 'rotate-legacy')
        assert.equal(await Auth.rotateToken(`${author.plainTextToken}${method === 'rotate-legacy' ? ':legacy-suffix' : ''}`), null)
      else {
        const headers = method === 'abilities-bearer'
          ? { authorization: `Bearer ${author.plainTextToken}` }
          : { cookie: authCookie(author.plainTextToken).split(';')[0]! }
        const request = enhanceRequest(new Request('https://revocation.test/', { headers }))
        await runWithRequest(request, async () => {
          assert.equal(await Auth.currentAccessToken(), undefined)
          assert.equal(await Auth.tokenCan('read'), false)
          assert.deepEqual(await Auth.tokenAbilities(), [])
          assert.equal(await Auth.user(), undefined)
          // Standalone helpers deliberately support non-user owners.
          assert.equal(await tokenCan('read'), true)
        })
      }
      assert.deepEqual(await db.selectFrom('oauth_access_tokens').selectAll().orderBy('id').get(), before)
      await assertPairLive(user, true)
      await assertPairLive(author, true)
    })
  }
  // Revoking the installation's personal client must stop new token issuance,
  // even when an unrelated, active OAuth client is still present.
  const personalClients = await db.selectFrom('oauth_clients').select('id').where('personal_access_client', '=', true).get()
  for (const client of personalClients)
    await revokeClient(Number(client.id))
  assert((await db.selectFrom('oauth_clients').where('personal_access_client', '=', true).select('revoked').get()).every(client => Boolean(client.revoked)))
  await createClient({ name: 'non-personal', redirect: 'https://revocation.test/callback', passwordClient: true })
  for (const withRefreshToken of [false, true]) {
    await check(`revoked personal clients cannot mint tokens (refresh: ${withRefreshToken})`, async () => {
      const before = await db.selectFrom('oauth_clients').selectAll().orderBy('id').get()
      await assert.rejects(createToken(42, 'revoked-client', ['read'], { withRefreshToken }), /No personal access client found/)
      assert.equal((await db.selectFrom('oauth_access_tokens').get()).length, 0)
      assert.equal((await db.selectFrom('oauth_refresh_tokens').get()).length, 0)
      assert.deepEqual(await db.selectFrom('oauth_clients').selectAll().orderBy('id').get(), before)
    })
  }
  await check('a replacement active personal client can mint both token forms', async () => {
    const active = await createClient({ name: 'replacement', redirect: 'https://revocation.test/callback', personalAccessClient: true })
    for (const withRefreshToken of [false, true]) {
      const pair = await createToken(42, 'active-client', ['read'], { withRefreshToken })
      assert.equal(Number(pair.accessToken.clientId), Number(active.client.id))
      assert(await findToken(pair.plainTextToken))
      assert.deepEqual(pair.accessToken.scopes, ['read'])
      if (withRefreshToken)
        assert.equal(await validateRefreshToken(pair.refreshToken!), true)
      else
        assert.equal(pair.refreshToken, undefined)
    }
  })
}
finally {
  await releaseOrm()
  resetDatabaseConnection()
}
assert.deepEqual(failures, [], failures.join('\n'))
console.log('token revocation isolation OK')
