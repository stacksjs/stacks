import assert from 'node:assert/strict'
import { setSystemTime } from 'bun:test'
import { readFileSync, writeFileSync } from 'node:fs'

const [phase, cookiesFile] = process.argv.slice(2)
const file = process.env.STACKS_SESSION_FIXTURE_DB
assert(file && cookiesFile, 'Only run with an isolated database and cookie fixture')
const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres')
const postgres = dialect === 'postgres' ? new URL(file) : undefined
if (postgres) {
  assert(postgres.pathname.startsWith('/stacks_session_test_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(postgres.hostname))
}
else {
  assert.equal(process.env.DB_DATABASE_PATH, file)
}

const { overridesReady } = await import('@stacksjs/config')
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection, sqlDateTime } = await import('@stacksjs/database')
await overridesReady
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: {
    default: dialect,
    connections: postgres ? {
      postgres: {
        name: postgres.pathname.slice(1), host: postgres.hostname, port: Number(postgres.port || 5432),
        username: decodeURIComponent(postgres.username), password: decodeURIComponent(postgres.password),
      },
    } : { sqlite: { database: file } },
    queryLogging: { enabled: false },
  },
})
const { configureOrm, releaseOrm } = await import('bun-query-builder')
if (dialect === 'sqlite')
  configureOrm({ database: file })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { Auth, SessionAuth, authCookie } = await import('@stacksjs/auth')
const { makeHash } = await import('@stacksjs/security')
const { createStacksRouter } = await import('@stacksjs/router')
const LogoutAction = (await import('../../../../defaults/app/Actions/Auth/LogoutAction')).default

const emails = ['alice@session.test', 'bob@session.test']
const password = 'session-fixture-password'

try {
  if (phase === 'login') {
    await db.unsafe(`CREATE TABLE users (
      id ${dialect === 'postgres' ? 'BIGINT' : 'INTEGER'} PRIMARY KEY, name TEXT, email TEXT NOT NULL, password TEXT NOT NULL,
      password_changed_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP
    )`).execute()
    await db.unsafe(`CREATE TABLE sessions (
      id TEXT PRIMARY KEY, user_id ${dialect === 'postgres' ? 'BIGINT' : 'INTEGER'} NOT NULL, ip_address TEXT, user_agent TEXT,
      payload TEXT NOT NULL, last_activity INTEGER NOT NULL, expires_at TIMESTAMP
    )`).execute()
    const hash = await makeHash(password, { algorithm: 'bcrypt' })
    for (const [index, email] of emails.entries())
      await db.insertInto('users').values({ id: index + 1, name: email, email, password: hash }).execute()
    const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
    await ensureFrameworkAuthTables()
  }

  const router = createStacksRouter({ autoDiscoverRoutes: false })
  router.get('/session-audit/start', () => new Response('<p>Session fixture</p>', { headers: { 'Content-Type': 'text/html' } }))
  router.post('/session-audit/login', async (req) => {
    const credentials = await req.json() as { email: string, password: string }
    const result = await SessionAuth.login(credentials.email, credentials.password)
    return Response.json({ id: result.user.id }, {
      headers: { 'Set-Cookie': authCookie(result.sessionId, { name: 'session_id', secure: false }) },
    })
  })
  router.post('/session-audit/token-login', async (req) => {
    const credentials = await req.json() as { email: string, password: string }
    return Auth.login(credentials)
  })
  router.get('/session-audit/me', async () => {
    const before = await Auth.user()
    await new Promise(resolve => setTimeout(resolve, 5))
    const after = await Auth.user()
    assert.equal(after?.id, before?.id, 'auth identity changed across an await')
    return { id: after?.id, email: after?.email }
  }).middleware('auth')
  router.post('/session-audit/logout', LogoutAction).middleware('auth')

  const server = await router.serve({ port: 0, hostname: '127.0.0.1' })
  try {
    const base = `http://127.0.0.1:${server.port}/session-audit`
    const start = await fetch(`${base}/start`, { headers: { accept: 'text/html' } })
    const csrfCookie = start.headers.getSetCookie().find(value => value.startsWith('X-CSRF-Token='))?.split(';')[0]
    assert(csrfCookie, 'the initial page must seed a CSRF cookie')
    const csrfToken = csrfCookie.slice(csrfCookie.indexOf('=') + 1)
    await start.arrayBuffer()
    const me = async (cookie: string, expectedId: number) => {
      const response = await fetch(`${base}/me`, { headers: { cookie, accept: 'application/json' } })
      assert.equal(response.status, 200, 'valid session must authenticate')
      const body = await response.json() as { id: number, email: string }
      assert.equal(Number(body.id), expectedId)
      assert.equal(body.email, emails[expectedId - 1])
    }

    let cookies: string[]
    if (phase === 'login') {
      cookies = []
      for (const email of emails) {
        const response = await fetch(`${base}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', accept: 'application/json', cookie: csrfCookie, 'x-csrf-token': csrfToken },
          body: JSON.stringify({ email, password }),
        })
        assert.equal(response.status, 200, `login must succeed: ${response.status === 200 ? '' : await response.clone().text()}`)
        const cookie = response.headers.getSetCookie().find(value => value.startsWith('session_id='))
        assert(cookie, 'session login must return its cookie')
        assert(cookie.includes('HttpOnly'))
        cookies.push(cookie.split(';')[0]!)
        await response.arrayBuffer()
      }
      assert.notEqual(cookies[0], cookies[1])
      writeFileSync(cookiesFile, JSON.stringify(cookies), { mode: 0o600 })
    }
    else {
      cookies = JSON.parse(readFileSync(cookiesFile, 'utf8'))
    }

    await Promise.all(Array.from({ length: 20 }, (_, index) => me(cookies[index % 2]!, index % 2 + 1)))
    const guest = await fetch(`${base}/me`, { headers: { accept: 'application/json' } })
    assert.equal(guest.status, 401)
    await guest.arrayBuffer()
    console.log(`PASS ${phase}: concurrent session isolation and guest rejection`)

    if (phase === 'logout') {
      const boundary = new Date('2030-01-02T03:04:05.000Z')
      try {
        setSystemTime(boundary)
        for (const offset of [-1, 0, 1]) {
          for (const method of ['user', 'check', 'refresh'] as const) {
            const id = `expiry-boundary-${method}-${offset}`
            await db.insertInto('sessions').values({
              id, user_id: 1, payload: '{}', last_activity: Math.floor(boundary.getTime() / 1000), expires_at: sqlDateTime(new Date(boundary.getTime() + offset)),
            }).execute()
            assert.equal(Boolean(await SessionAuth[method](id)), offset > 0, `${method}: expiry offset ${offset}ms`)
          }
        }
      }
      finally {
        setSystemTime()
      }

      // Token credentials take precedence even when another user's database
      // session is present. Signing out Bob must not revoke Alice's session.
      for (const transport of ['bearer', 'cookie']) {
        const login = await fetch(`${base}/token-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', accept: 'application/json', cookie: csrfCookie, 'x-csrf-token': csrfToken },
          body: JSON.stringify({ email: emails[1], password }),
        })
        assert.equal(login.status, 200)
        const { token } = await login.json() as { token: string }
        assert(token)
        const headers = new Headers({ cookie: `${cookies[0]}; ${csrfCookie}`, accept: 'application/json', 'x-csrf-token': csrfToken })
        if (transport === 'bearer')
          headers.set('authorization', `Bearer ${token}`)
        else
          headers.set('cookie', `${headers.get('cookie')}; ${authCookie(token).split(';')[0]}`)
        const before = await fetch(`${base}/me`, { headers })
        assert.equal(before.status, 200)
        assert.equal(Number((await before.json() as { id: number }).id), 2)
        const logout = await fetch(`${base}/logout`, { method: 'POST', headers })
        await logout.arrayBuffer()
        assert.equal(logout.status, 200)
        assert(!logout.headers.getSetCookie().some(value => value.startsWith('session_id=')), 'token logout must not clear an unrelated session cookie')
        const revoked = await fetch(`${base}/me`, { headers })
        await revoked.arrayBuffer()
        assert.equal(revoked.status, 401, `${transport} token must be revoked`)
        await me(cookies[0]!, 1)
        await me(cookies[1]!, 2)
      }

      // A real database failure must not become a successful logout response.
      if (dialect === 'postgres') {
        await db.unsafe("CREATE FUNCTION reject_session_logout() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture session deletion denied'; END; $$").execute()
        await db.unsafe('CREATE TRIGGER reject_session_logout BEFORE DELETE ON sessions FOR EACH ROW EXECUTE FUNCTION reject_session_logout()').execute()
      }
      else {
        await db.unsafe("CREATE TRIGGER reject_session_logout BEFORE DELETE ON sessions BEGIN SELECT RAISE(ABORT, 'fixture session deletion denied'); END").execute()
      }
      try {
        const denied = await fetch(`${base}/logout`, {
          method: 'POST', headers: { cookie: `${cookies[0]}; ${csrfCookie}`, accept: 'application/json', 'x-csrf-token': csrfToken },
        })
        await denied.arrayBuffer()
        assert.equal(denied.status, 500, 'failed database revocation must not report successful logout')
        assert(!denied.headers.getSetCookie().some(value => value.startsWith('session_id=')), 'failed logout must retain the cookie for retry')
        await me(cookies[0]!, 1)
      }
      finally {
        await db.unsafe(`DROP TRIGGER reject_session_logout${dialect === 'postgres' ? ' ON sessions' : ''}`).execute()
      }

      const response = await fetch(`${base}/logout`, {
        method: 'POST', headers: { cookie: `${cookies[0]}; ${csrfCookie}`, accept: 'application/json', 'x-csrf-token': csrfToken },
      })
      assert.equal(response.status, 200, 'logout must succeed')
      const cleared = response.headers.getSetCookie().find(value => value.startsWith('session_id='))
      assert(cleared?.includes('Max-Age=0'), 'logout must expire the database-session cookie')
      assert(cleared.includes('HttpOnly'))
      await response.arrayBuffer()
      const stale = await fetch(`${base}/me`, { headers: { cookie: cookies[0]!, accept: 'application/json' } })
      await stale.arrayBuffer()
      assert.equal(stale.status, 401, 'copied session cookie must stop authenticating after logout')
      await me(cookies[1]!, 2)
      console.log('PASS restart persistence, logout revocation, bystander preserved')
    }
  }
  finally {
    await server.stop(true)
  }
}
finally {
  releaseOrm()
  resetDatabaseConnection()
}
