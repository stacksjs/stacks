import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mock } from 'bun:test'

const { DB_HOST: host, DB_DATABASE: name, DB_USERNAME: username, DB_PASSWORD: password, DB_PORT: port } = process.env
assert.equal(process.env.DB_CONNECTION, 'postgres')
assert(name?.startsWith('stacks_session_routing_'))
assert(host && ['127.0.0.1', 'localhost', '[::1]'].includes(host))
assert.equal(process.env.STACKS_SESSION_REPLICA_USER, name)
const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
config.app.key = 'synthetic-session-routing-verification-key'
const realEmail = { ...await import('@stacksjs/email') }
const sent: unknown[] = []
mock.module('@stacksjs/email', () => ({ ...realEmail,
  template: async () => ({ text: 'Synthetic verification message' }),
  mail: { sendOrFail: async (message: unknown) => { sent.push(message) } },
}))
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection, withRoutingContext, contextHasWritten, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: 'postgres', connections: { postgres: {
    name, host, port: Number(port), username, password,
    replicas: [{ host, port: Number(port), username: name, password: process.env.STACKS_SESSION_REPLICA_PASSWORD }],
  } }, reads: { autoRoute: true }, queryLogging: { enabled: false },
} })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { releaseOrm } = await import('bun-query-builder')
const { SessionAuth } = await import('../../src/session-auth')
const { Auth } = await import('../../src/authentication')
const { createToken, revokeToken, createClient, revokeClient } = await import('../../src/tokens')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { migrateRbacTables } = await import('../../../database/src/rbac-tables')
const { createBqbRbacStore } = await import('../../src/rbac-store-bqb')
const { flushRbacCache, hasRole, hasPermission, setRbacStore } = await import('../../src/rbac')
const { getTwoFactorState, verifyTwoFactorLoginCode, createTwoFactorChallenge, consumeTwoFactorChallenge, stashPendingTwoFactorSecret, consumePendingTwoFactorSecret } = await import('../../src/two-factor')
const { generateTwoFactorSecret, generateTwoFactorToken } = await import('../../src/authenticator')
const { getUserPasskey, getUserPasskeys, updatePasskeyCounter } = await import('../../src/passkey')
const { createPersonalAccessClient } = await import('../../src/client')
const { consumeMagicLink } = await import('../../src/magic-link')
const { resendVerificationEmail } = await import('../../src/email-verification')
const { enhanceRequest } = await import('@stacksjs/router')
const { runWithRequest, setAmbientRequestContext } = await import('../../../router/src/request-context')
setAmbientRequestContext(true)
const failures: string[] = []

try {
  await db.unsafe('CREATE TABLE users (id BIGINT PRIMARY KEY, name TEXT, email TEXT, password TEXT, password_changed_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  await db.insertInto('users').values({ id: 1, name: 'Session fixture', email: 'session@example.invalid' }).execute()
  await db.unsafe('CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id BIGINT, expires_at TIMESTAMP, last_activity BIGINT, ip_address TEXT, user_agent TEXT)').execute()
  await db.unsafe('CREATE SCHEMA lagged').execute()
  await db.unsafe('CREATE TABLE lagged.sessions (LIKE public.sessions INCLUDING ALL)').execute()
  await db.unsafe(`GRANT USAGE ON SCHEMA lagged TO "${name}"`).execute()
  await db.unsafe(`GRANT SELECT ON lagged.sessions TO "${name}"`).execute()
  const expiry = sqlDateTime(new Date(Date.now() + 60_000))
  await db.insertInto('sessions').values({ id: 'revoked', user_id: 1, expires_at: expiry, last_activity: 0 }).execute()
  await db.unsafe('INSERT INTO lagged.sessions SELECT * FROM public.sessions').execute()
  await SessionAuth.logout('revoked')
  await db.insertInto('sessions').values({ id: 'fresh', user_id: 1, expires_at: expiry, last_activity: 0 }).execute()

  // Prove the stale snapshot is reachable before testing auth, and ensure
  // the fix does not silently disable ordinary read routing for the app.
  async function assertLaggedRead() {
    const rows = await db.selectFrom('sessions').selectAll().execute()
    assert.deepEqual(rows.map(row => row.id), ['revoked'])
  }
  await withRoutingContext(assertLaggedRead)
  for (const id of ['revoked', 'fresh']) {
    for (const method of ['check', 'user', 'refresh'] as const) {
      try {
        await withRoutingContext(async () => {
          assert.equal(contextHasWritten(), false)
          assert.equal(Boolean(await SessionAuth[method](id)), id === 'fresh', `${method}: ${id} session must use primary state`)
          if (method !== 'refresh') {
            assert.equal(contextHasWritten(), false, 'auth reads must not pretend to write')
            await assertLaggedRead()
          }
        })
      }
      catch (error) { failures.push(String(error)) }
    }
  }
  assert.deepEqual(failures, [])
  await assert.rejects(db.transaction(async () => {
    await SessionAuth.logout('fresh')
    assert.equal(await SessionAuth.check('fresh'), false, 'primary reads must see this transaction\'s revocation')
    throw new Error('rollback session fixture')
  }), /rollback session fixture/)
  assert.equal(await SessionAuth.check('fresh'), true, 'rolled-back revocation must preserve the session')
  let escapedRead: (() => unknown) | undefined
  await db.transaction(async () => {
    const read = db.primary.selectFrom
    escapedRead = () => read('sessions').executeTakeFirst()
    assert(await read('sessions').where('id', '=', 'fresh').executeTakeFirst())
  })
  await assert.rejects(async () => escapedRead!(), /transaction/i, 'retained primary methods must not escape their transaction')
  await withRoutingContext(assertLaggedRead)
  await ensureFrameworkAuthTables()
  const passkey = (id: string, counter: number) => ({ id, counter, user_id: 1, cred_public_key: '{}', webauthn_user_id: 'synthetic-user' })
  await db.insertInto('passkeys').values([passkey('revoked-key', 0), passkey('advanced-key', 1)] as never).execute()
  await db.unsafe('CREATE TABLE lagged.passkeys (LIKE public.passkeys INCLUDING ALL)').execute()
  await db.unsafe('INSERT INTO lagged.passkeys SELECT * FROM public.passkeys').execute()
  await db.unsafe(`GRANT SELECT ON lagged.passkeys TO "${name}"`).execute()
  await db.deleteFrom('passkeys').where('id', '=', 'revoked-key').execute()
  await db.updateTable('passkeys').set({ counter: 10 }).where('id', '=', 'advanced-key').execute()
  await db.insertInto('passkeys').values(passkey('fresh-key', 0) as never).execute()
  for (const mode of ['revoked', 'fresh', 'inventory', 'counter'] as const) {
    try {
      await withRoutingContext(async () => {
        if (mode === 'revoked') assert.equal(await getUserPasskey(1, 'revoked-key'), undefined, 'a revoked passkey must not be supplied for signature verification')
        if (mode === 'fresh') assert.equal((await getUserPasskey(1, 'fresh-key'))?.id, 'fresh-key', 'newly enrolled passkeys must be available immediately')
        if (mode === 'inventory') assert.deepEqual((await getUserPasskeys(1)).map(row => row.id).sort(), ['advanced-key', 'fresh-key'], 'passkey options must use current enrollment state')
        if (mode === 'counter') assert.equal(await updatePasskeyCounter(1, 'advanced-key', 4), false, 'a stale replica counter must not permit a rollback')
        assert.equal(contextHasWritten(), false, 'rejected passkey checks must not write')
        await assertLaggedRead()
      })
    }
    catch (error) { failures.push(String(error)) }
  }
  try {
    assert.equal(Number((await db.primary.selectFrom('passkeys').where('id', '=', 'advanced-key').selectAll().executeTakeFirst())?.counter), 10, 'the primary counter must remain monotonic')
  }
  catch (error) { failures.push(String(error)) }
  assert.deepEqual(failures, [])
  const revoked = await createToken(1, 'lagged-token', ['read'], { withRefreshToken: false })
  const client = await createClient({ name: 'lagged-client', redirect: 'https://example.invalid/callback' })
  for (const table of ['oauth_access_tokens', 'oauth_clients']) {
    await db.unsafe(`CREATE TABLE lagged.${table} (LIKE public.${table} INCLUDING ALL)`).execute()
    await db.unsafe(`INSERT INTO lagged.${table} SELECT * FROM public.${table}`).execute()
    await db.unsafe(`GRANT SELECT ON lagged.${table} TO "${name}"`).execute()
  }
  await revokeToken(revoked.plainTextToken)
  await revokeClient(client.client.id)
  const fresh = await createToken(1, 'fresh-token', ['read'], { withRefreshToken: false })
  for (const [pair, valid] of [[revoked, false], [fresh, true]] as const) {
    for (const mode of ['validate', 'user', 'ability', 'current', 'find', 'list'] as const) {
      try {
        const request = enhanceRequest(new Request('https://example.invalid/account', { headers: { authorization: `Bearer ${pair.plainTextToken}` } }))
        await withRoutingContext(() => runWithRequest(request, async () => {
          if (mode === 'validate') assert.equal(await Auth.validateToken(pair.plainTextToken), valid, `validate: token validity ${valid}`)
          if (mode === 'user') assert.equal(Boolean(await Auth.getUserFromToken(pair.plainTextToken)), valid, `user: token validity ${valid}`)
          if (mode === 'ability') assert.equal(await Auth.tokenCan('read'), valid, `ability: token validity ${valid}`)
          if (mode === 'current') assert.equal(Boolean(await Auth.currentAccessToken()), valid, `current: token validity ${valid}`)
          if (mode === 'find') assert.equal((await Auth.findToken(Number(pair.accessToken.id)))?.revoked, !valid, `find: revocation state ${!valid}`)
          if (mode === 'list') assert.equal((await Auth.tokens(1)).some(token => Number(token.id) === Number(pair.accessToken.id)), valid, `list: token validity ${valid}`)
        }))
      }
      catch (error) { failures.push(String(error)) }
    }
  }
  try {
    await withRoutingContext(() => assert.rejects(
      Auth.requestToken({ email: 'session@example.invalid', password: 'wrong' }, client.client.id, client.plainTextSecret),
      { status: 401, message: 'Invalid client credentials' },
      'revoked OAuth clients must fail before authenticating user credentials',
    ))
  }
  catch (error) { failures.push(String(error)) }
  assert.deepEqual(failures, [])
  assert.equal((await migrateRbacTables()).success, true)
  const store = createBqbRbacStore()
  setRbacStore(store)
  const [role, permission] = await db.transaction(async () => {
    const role = await store.createRole('revoked-admin')
    const permission = await store.createPermission('revoked-write')
    await store.assignRoleToUser(1, role.id)
    await store.assignPermissionToUser(1, permission.id)
    await store.assignPermissionToRole(role.id, permission.id)
    return [role, permission] as const
  })
  for (const table of ['roles', 'permissions', 'user_roles', 'user_permissions', 'role_permissions']) {
    await db.unsafe(`CREATE TABLE lagged.${table} (LIKE public.${table} INCLUDING ALL)`).execute()
    await db.unsafe(`INSERT INTO lagged.${table} SELECT * FROM public.${table}`).execute()
    await db.unsafe(`GRANT SELECT ON lagged.${table} TO "${name}"`).execute()
  }
  await store.removeRoleFromUser(1, role.id)
  await store.removePermissionFromUser(1, permission.id)
  await store.removePermissionFromRole(role.id, permission.id)
  for (const mode of ['role', 'direct', 'inherited', 'hasRole', 'hasPermission'] as const) {
    try {
      flushRbacCache()
      await withRoutingContext(async () => {
        if (mode === 'role') assert.deepEqual(await store.getUserRoles(1), [], 'revoked user role must not survive replica lag')
        if (mode === 'direct') assert.deepEqual(await store.getUserDirectPermissions(1), [], 'revoked direct permission must not survive replica lag')
        if (mode === 'inherited') assert.deepEqual(await store.getRolePermissions(role.id), [], 'revoked role permission must not survive replica lag')
        if (mode === 'hasRole') assert.equal(await hasRole(1, role.name), false, 'cold RBAC cache must not re-authorize a revoked role')
        if (mode === 'hasPermission') assert.equal(await hasPermission(1, permission.name), false, 'cold RBAC cache must not re-authorize a revoked permission')
        assert.equal(contextHasWritten(), false)
        await assertLaggedRead()
      })
    }
    catch (error) { failures.push(String(error)) }
  }
  for (const mode of ['role', 'direct', 'inherited'] as const) {
    try {
      await withRoutingContext(async () => {
        if (mode === 'role') await store.assignRoleToUser(1, role.id)
        if (mode === 'direct') await store.assignPermissionToUser(1, permission.id)
        if (mode === 'inherited') await store.assignPermissionToRole(role.id, permission.id)
      })
      const table = mode === 'role' ? 'user_roles' : mode === 'direct' ? 'user_permissions' : 'role_permissions'
      assert.equal((await db.primary.selectFrom(table).selectAll().execute()).length, 1, `${mode}: lagged pivot must not suppress re-assignment`)
    }
    catch (error) { failures.push(String(error)) }
  }
  try {
    // Outside request scope there is no sticky-write context to rescue the
    // create/read-back pair. It must still read the new primary row.
    const createdRole = await store.createRole('fresh-role')
    const createdPermission = await store.createPermission('fresh-permission')
    await withRoutingContext(async () => {
      assert.equal((await store.findRoleById(createdRole.id))?.name, createdRole.name)
      assert.equal((await store.findRoleByName(createdRole.name))?.id, createdRole.id)
      assert.equal((await store.findPermissionById(createdPermission.id))?.name, createdPermission.name)
      assert.equal((await store.findPermissionByName(createdPermission.name))?.id, createdPermission.id)
      assert((await store.getAllRoles()).some(item => item.id === createdRole.id))
      assert((await store.getAllPermissions()).some(item => item.id === createdPermission.id))
    })
  }
  catch (error) { failures.push(String(error)) }
  assert.deepEqual(failures, [])
  const secret = generateTwoFactorSecret()
  const challenge = await createTwoFactorChallenge(1)
  await stashPendingTwoFactorSecret(1, secret)
  for (const table of ['users', 'two_factor_challenges', 'two_factor_pending_secrets']) {
    await db.unsafe(`CREATE TABLE lagged.${table} (LIKE public.${table} INCLUDING ALL)`).execute()
    await db.unsafe(`INSERT INTO lagged.${table} SELECT * FROM public.${table}`).execute()
    await db.unsafe(`GRANT SELECT ON lagged.${table} TO "${name}"`).execute()
  }
  await db.updateTable('users').set({ two_factor_secret: secret, two_factor_enabled: true }).where('id', '=', 1).execute()
  try {
    await withRoutingContext(async () => {
      assert.equal((await getTwoFactorState(1)).enabled, true, 'recently enabled 2FA must not be skipped because the replica still says disabled')
    })
  }
  catch (error) { failures.push(String(error)) }
  // Let only the enabled-state snapshot catch up, not the consumed step.
  await db.unsafe('UPDATE lagged.users SET two_factor_secret = $1, two_factor_enabled = true WHERE id = 1', [secret]).execute()
  const code = await generateTwoFactorToken(secret)
  assert.equal(await withRoutingContext(() => verifyTwoFactorLoginCode(1, code)), true)
  try {
    assert.equal(await withRoutingContext(() => verifyTwoFactorLoginCode(1, code)), false, 'TOTP replay must read the primary consumed step')
  }
  catch (error) { failures.push(String(error)) }
  assert.equal(await withRoutingContext(() => consumeTwoFactorChallenge(challenge)), 1)
  assert.equal(await withRoutingContext(() => consumePendingTwoFactorSecret(1)), secret)
  for (const mode of ['challenge', 'pending'] as const) {
    try {
      const replay = await withRoutingContext(() => mode === 'challenge' ? consumeTwoFactorChallenge(challenge) : consumePendingTwoFactorSecret(1))
      assert.equal(replay, null, `${mode}: consumed credentials must not be replayed from a stale replica`)
    }
    catch (error) { failures.push(String(error)) }
  }
  assert.deepEqual(failures, [])
  // An empty replica must not permit duplicate personal access clients, and
  // provisioning outside request scope must read back its own committed row.
  await db.unsafe('DELETE FROM lagged.oauth_clients').execute()
  const personalClients = () => db.primary.selectFrom('oauth_clients').where('personal_access_client', '=', true).where('revoked', '=', false).selectAll().execute()
  const originalClients = await personalClients()
  assert.equal(originalClients.length, 1)
  try {
    const existing = await withRoutingContext(() => createPersonalAccessClient())
    assert.equal(existing.isErr, true, 'replica lag must not bypass the personal-client existence check')
    assert.equal((await personalClients()).length, 1, 'the refused creation must not insert a duplicate')
  }
  catch (error) { failures.push(String(error)) }
  await db.deleteFrom('oauth_clients').where('personal_access_client', '=', true).execute()
  try {
    const created = await createPersonalAccessClient()
    assert.equal(created.isOk, true, 'read-back outside request scope must use the primary')
    assert.equal((await personalClients()).length, 1)
  }
  catch (error) { failures.push(String(error)) }
  assert.deepEqual(failures, [])
  // The user model is a separate query surface from the session/token
  // lookup. Pin that it cannot reintroduce stale account state afterward.
  await db.updateTable('users').set({ name: 'Primary account' }).where('id', '=', 1).execute()
  for (const mode of ['session', 'token'] as const) {
    try {
      await withRoutingContext(async () => {
        const lagged = await db.selectFrom('users').selectAll().where('id', '=', 1).executeTakeFirst()
        assert.equal(lagged?.name, 'Session fixture', 'the user replica must really be stale')
        const user = mode === 'session' ? await SessionAuth.user('fresh') : await Auth.getUserFromToken(fresh.plainTextToken)
        assert.equal(user?.name, 'Primary account', `${mode}: the resolved user must reflect the primary`)
      })
    }
    catch (error) { failures.push(String(error)) }
  }
  assert.deepEqual(failures, [])
  await db.unsafe('CREATE TABLE magic_link_tokens (id BIGSERIAL PRIMARY KEY, user_id BIGINT, email TEXT, token TEXT UNIQUE, expires_at TIMESTAMP, consumed_at TIMESTAMP, updated_at TIMESTAMP, redirect_to TEXT)').execute()
  await db.unsafe('CREATE TABLE lagged.magic_link_tokens (LIKE public.magic_link_tokens INCLUDING ALL)').execute()
  await db.unsafe(`GRANT SELECT ON lagged.magic_link_tokens TO "${name}"`).execute()
  const magic = 'synthetic-primary-magic-link'
  await db.insertInto('magic_link_tokens').values({ user_id: 1, email: 'session@example.invalid', token: createHash('sha256').update(magic).digest('hex'), expires_at: sqlDateTime(new Date(Date.now() + 60_000)), redirect_to: '/account' }).execute()
  assert.equal((await consumeMagicLink(magic)).ok, true, 'out-of-request magic-link readback must find the claim on primary')
  await db.unsafe('CREATE TABLE lagged.email_verifications (LIKE public.email_verifications INCLUDING ALL)').execute()
  await db.unsafe(`GRANT SELECT ON lagged.email_verifications TO "${name}"`).execute()
  await db.insertInto('email_verifications').values({ user_id: 1, token: 'synthetic-cooldown', created_at: sqlDateTime(), expires_at: sqlDateTime(new Date(Date.now() + 60_000)) }).execute()
  await withRoutingContext(async () => {
    assert.equal((await db.selectFrom('email_verifications').selectAll().execute()).length, 0, 'the replica must actually be missing the recent send')
    assert.equal((await resendVerificationEmail({ id: 1, email: 'session@example.invalid' })).success, false, 'replica lag must not bypass the verification resend cooldown')
    assert.equal(sent.length, 0, 'a rejected resend must not deliver mail')
    assert.equal(contextHasWritten(), false, 'cooldown checks must remain read-only')
    await assertLaggedRead()
  })
  console.log('session and token primary reads OK')
}
finally {
  mock.module('@stacksjs/email', () => realEmail)
  await releaseOrm()
  await closeDatabaseConnection()
}
