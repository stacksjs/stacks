import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_LOGIN_RACE_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-session-login-race-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_login_race_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
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
const { configureOrm, releaseOrm } = await import('bun-query-builder')
if (dialect === 'sqlite') configureOrm({ database: process.env.DB_DATABASE_PATH! })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { SessionAuth } = await import('../../src/session-auth')
const { Auth } = await import('../../src/authentication')
const { findToken, revokeAllTokens } = await import('../../src/tokens')
const { RateLimiter } = await import('../../src/rate-limiter')
const { makeHash } = await import('@stacksjs/security')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { enhanceRequest } = await import('@stacksjs/router')
const { runWithRequest, setAmbientRequestContext } = await import('../../../router/src/request-context')
const LoginAction = (await import('../../../../defaults/app/Actions/Auth/LoginAction')).default
setAmbientRequestContext(true)
const failures: string[] = []
const email = 'login-race@example.invalid'
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email VARCHAR(255), password TEXT, password_changed_at TIMESTAMP NULL, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  await db.unsafe('CREATE TABLE sessions (id VARCHAR(255) PRIMARY KEY, user_id INTEGER, payload TEXT, expires_at TIMESTAMP, last_activity INTEGER, ip_address TEXT, user_agent TEXT)').execute()
  await ensureFrameworkAuthTables()
  const oldHash = await makeHash('old-synthetic-password', { algorithm: 'bcrypt' })
  const newHash = await makeHash('new-synthetic-password', { algorithm: 'bcrypt' })
  const cases = (['session', 'bearer', 'bearer-request', 'action', 'action-2fa'] as const)
    .flatMap(mode => (['password', 'deleted', 'unchanged'] as const).map(change => ({ mode, change })))
  for (const { mode, change } of cases) {
    await db.deleteFrom('oauth_refresh_tokens').execute()
    await db.deleteFrom('oauth_access_tokens').execute()
    await db.deleteFrom('sessions').execute()
    await db.deleteFrom('two_factor_challenges').execute()
    await db.deleteFrom('users').execute()
    await db.insertInto('users').values({ id: 1, name: 'Fixture', email, password: oldHash }).execute()
    if (mode === 'action-2fa') await db.updateTable('users').set({ two_factor_enabled: true } as never).where('id', '=', 1).execute()
    let changed = false
    // The public asynchronous limiter-store seam is reached after the real
    // bcrypt verification, but before session persistence. Commit a competing
    // credential change there without mocking the database or hash verifier.
    RateLimiter.useStore({ get: () => undefined, set() {}, async delete() {
      changed = true
      if (change === 'password') {
        await db.updateTable('users').set({ password: newHash, password_changed_at: sqlDateTime() } as never).where('id', '=', 1).execute()
        await SessionAuth.destroyAll(1)
        await revokeAllTokens(1)
      }
      if (change === 'deleted') await db.deleteFrom('users').where('id', '=', 1).execute()
    } })
    const login = async () => {
      if (mode === 'session') return SessionAuth.login(email, 'old-synthetic-password')
      const credentials = { email, password: 'old-synthetic-password' }
      if (mode === 'action' || mode === 'action-2fa')
        return LoginAction.handle({ get: (key: string) => credentials[key as keyof typeof credentials] } as never) as Promise<Response>
      if (mode === 'bearer') return Auth.login(credentials)
      const request = enhanceRequest(new Request('http://localhost/login-race'))
      return runWithRequest(request, () => Auth.login(credentials))
    }
    try {
      if (change === 'unchanged') {
        const result = await login()
        assert(result)
        if (result instanceof Response) {
          assert.equal(result.status, 200)
          const body = await result.json() as { requires_two_factor?: boolean, access_token?: string }
          if (mode === 'action-2fa') {
            assert.equal(body.requires_two_factor, true)
            assert.equal((await db.primary.selectFrom('oauth_access_tokens').selectAll().execute()).length, 0)
          }
          else assert(await findToken(body.access_token!))
        }
        else if ('sessionId' in result) assert(await SessionAuth.check(result.sessionId))
        else assert(await findToken(result.token))
      }
      else {
        if (mode === 'session') await assert.rejects(login)
        else if (mode === 'action' || mode === 'action-2fa') assert.equal((await login() as Response).status, 401)
        else assert.equal(Boolean(await login()), false, 'stale credentials must not issue a bearer')
        assert.equal((await db.primary.selectFrom('sessions').selectAll().execute()).length, 0)
        assert.equal((await db.primary.selectFrom('oauth_access_tokens').selectAll().execute()).length, 0)
        assert.equal((await db.primary.selectFrom('oauth_refresh_tokens').selectAll().execute()).length, 0)
        assert.equal((await db.primary.selectFrom('two_factor_challenges').selectAll().execute()).length, 0)
      }
      assert(changed, 'the competing operation must run after password verification')
    }
    catch (error) { failures.push(`${mode} ${change}: ${String(error)}`) }
    finally { RateLimiter.useMemoryStore() }
  }
  for (const mode of ['session', 'bearer', 'bearer-request'] as const) {
    await db.deleteFrom('oauth_refresh_tokens').execute()
    await db.deleteFrom('oauth_access_tokens').execute()
    await db.deleteFrom('sessions').execute()
    await db.deleteFrom('users').execute()
    await db.insertInto('users').values({ id: 1, name: 'Fixture', email, password: oldHash }).execute()
    try {
      await assert.rejects(() => db.transaction(async () => {
        const credentials = { email, password: 'old-synthetic-password' }
        const result = mode === 'session'
          ? await SessionAuth.login(email, credentials.password)
          : mode === 'bearer'
            ? await Auth.login(credentials)
            : await runWithRequest(enhanceRequest(new Request('http://localhost/login-rollback')), () => Auth.login(credentials))
        assert(result, 'valid login must succeed inside the transaction')
        throw new Error('synthetic credential rollback')
      }), /synthetic credential rollback/)
      for (const table of ['sessions', 'oauth_access_tokens', 'oauth_refresh_tokens'])
        assert.equal((await db.primary.selectFrom(table).selectAll().execute()).length, 0, `${table} must roll back`)
    }
    catch (error) { failures.push(`${mode} rollback: ${String(error)}`) }
  }
  for (const effect of dialect === 'mysql' ? ['wrong-owner', 'expired'] : ['suppressed', 'wrong-owner', 'expired']) {
    await db.deleteFrom('sessions').execute()
    await db.insertInto('sessions').values({ id: 'synthetic-bystander', user_id: 2, payload: '{}', last_activity: 0,
      expires_at: sqlDateTime(new Date(Date.now() + 60_000)) }).execute()
    if (dialect === 'postgres') {
      const body = effect === 'suppressed' ? 'RETURN NULL;' : effect === 'wrong-owner'
        ? 'NEW.user_id := 2; RETURN NEW;' : "NEW.expires_at := '2000-01-01'; RETURN NEW;"
      await db.unsafe(`CREATE FUNCTION alter_session_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${body} END; $$`).execute()
      await db.unsafe('CREATE TRIGGER alter_session_insert BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION alter_session_insert()').execute()
    }
    else if (dialect === 'mysql') {
      const body = effect === 'wrong-owner' ? 'NEW.user_id = 2' : "NEW.expires_at = '2000-01-01'"
      await db.unsafe(`CREATE TRIGGER alter_session_insert BEFORE INSERT ON sessions FOR EACH ROW SET ${body}`).execute()
    }
    else {
      const body = effect === 'suppressed' ? 'SELECT RAISE(IGNORE)' : effect === 'wrong-owner'
        ? 'UPDATE sessions SET user_id = 2 WHERE id = NEW.id' : "UPDATE sessions SET expires_at = '2000-01-01' WHERE id = NEW.id"
      await db.unsafe(`CREATE TRIGGER alter_session_insert ${effect === 'suppressed' ? 'BEFORE' : 'AFTER'} INSERT ON sessions BEGIN ${body}; END`).execute()
    }
    try {
      await assert.rejects(SessionAuth.login(email, 'old-synthetic-password'),
        error => (error as { status?: number }).status === 500,
        `a ${effect} session insert must not return a usable session ID`)
      const sessions = await db.primary.selectFrom('sessions').select('id').execute()
      assert.deepEqual(sessions.map(row => row.id), ['synthetic-bystander'], 'failed issuance must roll back without touching other sessions')
    }
    catch (error) { failures.push(`session insert ${effect}: ${String(error)}`) }
    finally {
      await db.unsafe(`DROP TRIGGER alter_session_insert${dialect === 'postgres' ? ' ON sessions' : ''}`).execute()
      if (dialect === 'postgres') await db.unsafe('DROP FUNCTION alter_session_insert()').execute()
    }
  }
  await db.insertInto('users').values({ id: 2, name: 'Previous principal', email: 'previous@example.invalid', password: oldHash }).execute()
  if (dialect === 'postgres') {
    await db.unsafe("CREATE FUNCTION reject_direct_login() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture direct login denied'; END; $$").execute()
    await db.unsafe('CREATE TRIGGER reject_direct_login BEFORE INSERT ON oauth_refresh_tokens FOR EACH ROW EXECUTE FUNCTION reject_direct_login()').execute()
  }
  else if (dialect === 'mysql')
    await db.unsafe("CREATE TRIGGER reject_direct_login BEFORE INSERT ON oauth_refresh_tokens FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture direct login denied'").execute()
  else
    await db.unsafe("CREATE TRIGGER reject_direct_login BEFORE INSERT ON oauth_refresh_tokens BEGIN SELECT RAISE(ABORT, 'fixture direct login denied'); END").execute()
  try {
    const { User } = await import('@stacksjs/orm')
    const previous = await User.find(2)
    assert(previous)
    for (const initial of [undefined, previous]) {
      try {
        await runWithRequest(enhanceRequest(new Request('http://localhost/failed-direct-login')), async () => {
          Auth.setUser(initial)
          await assert.rejects(Auth.loginUsingId(1), /fixture direct login denied/)
          assert((await Auth.user()) === initial, 'failed issuance must preserve the previous request principal')
        })
      }
      catch (error) { failures.push(`failed direct login/previous=${Boolean(initial)}: ${error}`) }
    }
  }
  finally {
    await db.unsafe(`DROP TRIGGER reject_direct_login${dialect === 'postgres' ? ' ON oauth_refresh_tokens' : ''}`).execute()
    if (dialect === 'postgres') await db.unsafe('DROP FUNCTION reject_direct_login()').execute()
  }
  await runWithRequest(enhanceRequest(new Request('http://localhost/successful-direct-login')), async () => {
    assert.equal(await Auth.user(), undefined)
    const result = await Auth.loginUsingId(1)
    assert(result)
    assert.equal(await Auth.user(), result.user, 'successful issuance establishes the new principal')
  })
  assert.deepEqual(failures, [])
  console.log('session login races OK')
}
finally {
  RateLimiter.useMemoryStore()
  await releaseOrm()
  await closeDatabaseConnection()
}
