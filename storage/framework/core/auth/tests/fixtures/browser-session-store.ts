import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const phase = process.argv[2]
assert(phase === 'login' || phase === 'resume')
const directory = process.env.STACKS_BROWSER_SESSION_DIRECTORY
assert(directory)
const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres')
const file = process.env.DB_DATABASE_PATH
if (dialect === 'sqlite') assert(file && resolve(file).startsWith(`${resolve(directory)}/`))
else {
  assert(['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST!))
  assert(process.env.DB_DATABASE?.startsWith('stacks_browser_session_'))
}
const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test', url: 'http://127.0.0.1' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: file } } : {
    postgres: { name: process.env.DB_DATABASE!, host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME!, password: process.env.DB_PASSWORD! },
  }, queryLogging: { enabled: false },
} })
config.auth.session = { ...config.auth.session, lifetime: 60_000, enforceFingerprint: { userAgent: true } }
const { configureOrm, releaseOrm } = await import('bun-query-builder')
if (dialect === 'sqlite') configureOrm({ database: file })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { Auth, SessionAuth, authCookie, startBrowserSession, browserSessionCookie, browserSessionIdentifier, browserSessions, revokeBrowserSession, createToken, findToken, revokeAccountCredentials } = await import('@stacksjs/auth')
const { createStacksRouter } = await import('@stacksjs/router')
const LogoutAction = (await import('../../../../defaults/app/Actions/Auth/LogoutAction')).default
const stateFile = join(directory, 'browser-state.json')
const issuedTokens: string[] = []

try {
  if (phase === 'login') {
    await db.unsafe(`CREATE TABLE users (id ${dialect === 'sqlite' ? 'INTEGER' : 'BIGINT'} PRIMARY KEY, name TEXT, email TEXT, password TEXT, password_changed_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP)`).execute()
    for (const id of [1, 2]) await db.insertInto('users').values({ id, name: `Owned browser ${id}`, email: `browser${id}@owned.invalid`, password: 'unused-owned-fixture' }).execute()
    const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
    await ensureFrameworkAuthTables()
    // The actual migrator owns this schema; a second pass preserves its rows.
    await ensureFrameworkAuthTables()
  }
  const router = createStacksRouter({ autoDiscoverRoutes: false })
  router.get('/browser/start', () => new Response('<p>Owned browser fixture</p>', { headers: { 'Content-Type': 'text/html' } }))
  router.post('/browser/login', async (request) => {
    const { userId } = await request.json() as { userId: number }
    const issued = await Auth.loginUsingId(userId, { expiresInMinutes: 2 / 60 })
    assert(issued)
    issuedTokens.push(issued.token)
    const session = await startBrowserSession(issued.token)
    assert(session)
    return Response.json({ identifier: session.identifier }, { headers: { 'Set-Cookie': browserSessionCookie(session) } })
  })
  router.get('/browser/me', async () => ({ id: Number((await Auth.user())?.id) })).middleware('auth')
  router.get('/browser/sessions', async (request) => browserSessions(Number(await Auth.id()), request.cookie('session_id') ?? '')).middleware('auth')
  router.post('/browser/revoke', async (request) => {
    const { id } = await request.json() as { id: string }
    await revokeBrowserSession(Number(await Auth.id()), id)
    return { ok: true }
  }).middleware('auth')
  router.post('/browser/logout', LogoutAction)
  const server = await router.serve({ port: 0, hostname: '127.0.0.1' })
  try {
    const base = `http://127.0.0.1:${server.port}/browser`
    const seeded = await fetch(`${base}/start`, { headers: { accept: 'text/html' } })
    const csrfCookie = seeded.headers.getSetCookie().find(value => value.startsWith('X-CSRF-Token='))?.split(';')[0]
    assert(csrfCookie)
    await seeded.arrayBuffer()
    const headers = (cookie = '') => ({ cookie: `${cookie}; ${csrfCookie}`, accept: 'application/json', 'Content-Type': 'application/json', 'x-csrf-token': csrfCookie.slice(csrfCookie.indexOf('=') + 1) })
    const me = async (cookie: string, expected: number | null, authorization?: string) => {
      const response = await fetch(`${base}/me`, { headers: { cookie, ...(authorization ? { authorization } : {}) } })
      assert.equal(response.status, expected === null ? 401 : 200)
      if (expected === null) await response.arrayBuffer()
      else assert.equal(Number((await response.json() as { id: number }).id), expected)
      assert(!response.headers.getSetCookie().some(value => value.startsWith('session_id=')), 'ordinary reads must not rotate a browser cookie')
    }
    if (phase === 'login') {
      const sessions = []
      for (const userId of [1, 2]) {
        const login = await fetch(`${base}/login`, { method: 'POST', headers: headers(), body: JSON.stringify({ userId }) })
        assert.equal(login.status, 200, await login.clone().text())
        const cookie = login.headers.getSetCookie().find(value => value.startsWith('session_id='))
        assert(cookie?.includes('HttpOnly') && cookie.includes('SameSite=Lax') && cookie.includes('Path=/'))
        const { identifier } = await login.json() as { identifier: string }
        const credential = decodeURIComponent(cookie.split(';')[0]!.slice('session_id='.length))
        assert.equal(browserSessionIdentifier(credential), identifier)
        const row = await db.selectFrom('auth_browser_sessions').where('id', '=', identifier).selectAll().executeTakeFirst()
        assert(row && row.id !== credential && !JSON.stringify(row).includes(credential), 'SQL must not retain the plaintext browser credential')
        assert.equal(await findToken(issuedTokens[userId - 1]!), null, 'the sign-in bearer is retired with its refresh partner')
        sessions.push({ cookie: cookie.split(';')[0]!, identifier })
        await me(sessions[userId - 1]!.cookie, userId)
      }
      const scoped = (await createToken(1, 'owned-read-only', ['read'], { withRefreshToken: false })).plainTextToken
      assert.equal(await startBrowserSession(scoped), null, 'a limited token must not become full browser authority')
      assert(await findToken(scoped), 'a refused handoff must preserve the original credential')
      const oneUse = await Auth.loginUsingId(1)
      assert(oneUse)
      const simultaneous = await Promise.all([startBrowserSession(oneUse.token), startBrowserSession(oneUse.token)])
      assert.equal(simultaneous.filter(Boolean).length, 1, 'one sign-in token must not produce two durable sessions')
      await revokeBrowserSession(1, simultaneous.find(Boolean)!.identifier)
      const previousToken = await Auth.loginUsingId(1)
      const replacementToken = await Auth.loginUsingId(2)
      assert(previousToken && replacementToken)
      const previousSession = await startBrowserSession(previousToken.token)
      assert(previousSession)
      const replacementSession = await startBrowserSession(replacementToken.token, { previousSession: previousSession.sessionId })
      assert(replacementSession)
      assert.equal(await SessionAuth.check(previousSession.sessionId), false, 'changing accounts retires the previous browser credential')
      assert.equal(await SessionAuth.check(replacementSession.sessionId), true)
      await revokeBrowserSession(2, replacementSession.identifier)
      const oldCookieToken = await Auth.loginUsingId(1)
      const oldBrowserToken = await Auth.loginUsingId(1)
      assert(oldCookieToken && oldBrowserToken)
      const oldBrowser = await startBrowserSession(oldBrowserToken.token)
      assert(oldBrowser)
      const oldCookies = `${browserSessionCookie(oldBrowser).split(';')[0]}; ${authCookie(oldCookieToken.token).split(';')[0]}`
      const switched = await fetch(`${base}/login`, { method: 'POST', headers: headers(oldCookies), body: JSON.stringify({ userId: 2 }) })
      assert.equal(switched.status, 200)
      const switchedBody = await switched.json() as { identifier: string }
      assert.equal(await findToken(oldCookieToken.token), null)
      assert.equal(await SessionAuth.check(oldBrowser.sessionId), false)
      await revokeBrowserSession(2, switchedBody.identifier)
      const legacy = await Auth.loginUsingId(1, { userAgent: 'Owned API client', ipAddress: '127.0.0.1' })
      assert(legacy)
      const legacyToken = await findToken(legacy.token)
      assert(legacyToken)
      const legacyDescription = (await browserSessions(1, legacy.token)).find(session => session.id === `access:${legacyToken.id}`)
      assert(legacyDescription?.current && legacyDescription.userAgent === 'Owned API client')
      await revokeBrowserSession(2, legacyDescription.id)
      assert(await findToken(legacy.token), 'another owner cannot revoke a legacy sign-in')
      await revokeBrowserSession(1, legacyDescription.id)
      assert.equal(await findToken(legacy.token), null)
      const transactional = await Auth.loginUsingId(1)
      assert(transactional)
      const beforeFailure = (await browserSessions(1)).length
      if (dialect === 'sqlite') {
        await db.unsafe('CREATE TRIGGER deny_browser_handoff BEFORE UPDATE OF revoked ON oauth_access_tokens WHEN NEW.revoked = 1 BEGIN SELECT RAISE(IGNORE); END').execute()
      }
      else {
        await db.unsafe('CREATE FUNCTION deny_browser_handoff() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.revoked THEN RETURN NULL; END IF; RETURN NEW; END; $$').execute()
        await db.unsafe('CREATE TRIGGER deny_browser_handoff BEFORE UPDATE OF revoked ON oauth_access_tokens FOR EACH ROW EXECUTE FUNCTION deny_browser_handoff()').execute()
      }
      try {
        await assert.rejects(startBrowserSession(transactional.token), (error: unknown) => !!error && typeof error === 'object' && 'status' in error && error.status === 500)
        assert.equal((await browserSessions(1)).length, beforeFailure, 'failed handoff must roll back the new session')
        assert(await findToken(transactional.token), 'failed handoff preserves the original usable token')
      }
      finally {
        await db.unsafe(`DROP TRIGGER deny_browser_handoff${dialect === 'postgres' ? ' ON oauth_access_tokens' : ''}`).execute()
        if (dialect === 'postgres') await db.unsafe('DROP FUNCTION deny_browser_handoff()').execute()
      }
      const retried = await startBrowserSession(transactional.token)
      assert(retried)
      await revokeBrowserSession(1, retried.identifier)
      const api = await Auth.loginUsingId(2, { expiresInMinutes: 2 / 60, withRefreshToken: false })
      assert(api)
      writeFileSync(stateFile, JSON.stringify({ sessions, apiToken: api.token, apiExpiry: Date.now() + 2200 }), { mode: 0o600 })
    }
    else {
      const state = JSON.parse(readFileSync(stateFile, 'utf8')) as { sessions: Array<{ cookie: string, identifier: string }>, apiToken: string, apiExpiry: number }
      await Bun.sleep(Math.max(0, state.apiExpiry - Date.now()))
      const [alice, bob] = state.sessions
      assert(alice && bob)
      assert.equal(await findToken(state.apiToken), null, 'the real short-lived API bearer has expired')
      await me(alice.cookie, 1)
      await me(bob.cookie, 2)
      const changedAgent = await fetch(`${base}/me`, { headers: { cookie: alice.cookie, 'User-Agent': 'owned-different-browser' } })
      await changedAgent.arrayBuffer()
      assert.equal(changedAgent.status, 401)
      await me(alice.cookie, 1)
      await me(alice.cookie, null, `Bearer ${state.apiToken}`)
      await me(`session_id=${encodeURIComponent(alice.identifier)}`, null)
      await me('', null, `Bearer ${decodeURIComponent(alice.cookie.slice('session_id='.length))}`)
      const listed = await fetch(`${base}/sessions`, { headers: { cookie: alice.cookie } })
      assert.equal(listed.status, 200)
      const descriptions = await listed.json() as Array<{ id: string, current: boolean }>
      assert.equal(descriptions.length, 1)
      assert.equal(descriptions[0]?.id, alice.identifier)
      assert.equal(descriptions[0]?.current, true)
      const body = JSON.stringify({ id: bob.identifier })
      const noCsrf = await fetch(`${base}/revoke`, { method: 'POST', headers: { cookie: alice.cookie, 'Content-Type': 'application/json' }, body })
      await noCsrf.arrayBuffer()
      assert.equal(noCsrf.status, 403)
      const otherOwner = await fetch(`${base}/revoke`, { method: 'POST', headers: headers(alice.cookie), body })
      await otherOwner.arrayBuffer()
      assert.equal(otherOwner.status, 200)
      await me(bob.cookie, 2)
      const secondaryToken = await Auth.loginUsingId(1)
      assert(secondaryToken)
      const secondary = await startBrowserSession(secondaryToken.token)
      assert(secondary)
      await revokeAccountCredentials(1, { exceptSessionId: decodeURIComponent(alice.cookie.slice('session_id='.length)) })
      await me(alice.cookie, 1)
      await me(browserSessionCookie(secondary).split(';')[0]!, null)
      const reads = Array.from({ length: 16 }, () => fetch(`${base}/me`, { headers: { cookie: alice.cookie } }))
      const logout = await fetch(`${base}/logout`, { method: 'POST', headers: headers(alice.cookie) })
      await logout.arrayBuffer()
      assert.equal(logout.status, 200)
      assert(logout.headers.getSetCookie().some(value => value.startsWith('session_id=') && value.includes('Max-Age=0')))
      for (const read of await Promise.all(reads)) {
        await read.arrayBuffer()
        assert([200, 401].includes(read.status))
        assert(!read.headers.getSetCookie().some(value => value.startsWith('session_id=')))
      }
      await me(alice.cookie, null)
      await me(bob.cookie, 2)
      await revokeAccountCredentials(2)
      await me(bob.cookie, null)
      const issued = await Auth.loginUsingId(1)
      assert(issued)
      const expiring = await startBrowserSession(issued.token, { lifetimeMs: 3000 })
      assert(expiring)
      const expiresCookie = browserSessionCookie(expiring).split(';')[0]!
      await me(expiresCookie, 1)
      await Bun.sleep(Math.max(0, Date.parse(expiring.expiresAt) - Date.now() + 50))
      await me(expiresCookie, null)
      assert.equal(await SessionAuth.check(expiring.sessionId), false)
      assert.equal((await browserSessions(1)).length, 0)
      const idleToken = await Auth.loginUsingId(1)
      assert(idleToken)
      const idleSession = await startBrowserSession(idleToken.token)
      assert(idleSession)
      await db.updateTable('auth_browser_sessions').set({ last_activity: Math.floor(Date.now() / 1000) - 5 }).where('id', '=', idleSession.identifier).execute()
      const previousIdle = config.auth.idleTimeout
      config.auth.idleTimeout = 1000
      try { await me(browserSessionCookie(idleSession).split(';')[0]!, null) }
      finally { config.auth.idleTimeout = previousIdle }
      assert.equal((await browserSessions(1)).length, 0)
    }
    console.log(`browser session ${phase} OK`)
  }
  finally { await server.stop(true) }
}
finally {
  releaseOrm()
  resetDatabaseConnection()
}
