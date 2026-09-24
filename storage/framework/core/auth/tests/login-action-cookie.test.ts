/**
 * `POST /login` must hand the browser a session cookie, measured on the real
 * response rather than read out of the source (stacksjs/stacks#2306).
 *
 * The report was an HTTP measurement:
 *
 *   HTTP/1.1 200 OK
 *   Set-Cookie count: 0
 *   body keys: access_token, expires_in, refresh_token, token, token_type, user
 *
 * `tests/unit/auth-session-cookie-contract.test.ts` pins the same requirement,
 * but it asserts on the TEXT of the shipped actions - it says so itself, because
 * there was no harness that invoked an action and looked at its response
 * headers. A text contract cannot tell `authCookie(result.token)` in a header
 * from `authCookie(result.token)` in a comment, and it cannot notice that the
 * cookie carries a token the body never mentions.
 *
 * This is that harness. `Action` exposes `handle` directly and its own docstring
 * shows `await action.handle(mockReq)`, so the action runs here against a real
 * SQLite database and a real bcrypt password, and the assertions are on the
 * `Response` it returns.
 *
 * Boot pattern follows `logout-all.test.ts`: throwaway SQLite, hand-shaped
 * `users` (the auth migrator does not own that table), framework auth tables
 * from the migrator.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, setSystemTime, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { releaseOrm } from 'bun-query-builder'

const DB_PATH = join(tmpdir(), `stacks-2306-login-cookie-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'testing'

const { configureOrm } = await import('bun-query-builder')
const { config } = await import('@stacksjs/config')
const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig, parseSqlDateTime, sqlDateTime } = await import('@stacksjs/database')
const { ensureFrameworkAuthTables } = await import('./helpers/auth-schema')
const { makeHash } = await import('@stacksjs/security')
const { createStacksRouter } = await import('@stacksjs/router')
const { Auth } = await import('../src/authentication')
const { authCookie, authCookieName } = await import('../src/cookie')

const LoginAction = (await import('../../../defaults/app/Actions/Auth/LoginAction')).default
const LogoutAction = (await import('../../../defaults/app/Actions/Auth/LogoutAction')).default
const MagicLinkConsumeAction = (await import('../../../defaults/app/Actions/Auth/MagicLinkConsumeAction')).default
const RefreshTokenAction = (await import('../../../defaults/app/Actions/Auth/RefreshTokenAction')).default
const RegisterAction = (await import('../../../defaults/app/Actions/Auth/RegisterAction')).default

const EMAIL = 'cookie-proof@example.com'
const PASSWORD = 'correct-horse-battery'
const CSRF_TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

let releaseDbConfigLock: () => void

/**
 * Re-pin the lazy `db` proxy to THIS file's SQLite path. `@stacksjs/database`
 * kicks off a background config reload at module load and bun runs a whole
 * directory in one process, so a sibling file's hooks can otherwise win the
 * connection between tests.
 */
async function forceConfig(): Promise<void> {
  process.env.DB_CONNECTION = 'sqlite'
  process.env.DB_DATABASE_PATH = DB_PATH

  // `Auth.attempt` reaches the database through the ORM, which is a SECOND
  // connection: `initializeDbConfig` steers the `db` proxy, `configureOrm`
  // steers bun-query-builder, and pointing only the first leaves `User.where()`
  // querying whatever database a sibling test file opened. Setting the env
  // alone does not fix it either - measured, because the connection is already
  // open by then. Both are pointed at this file's path, per test, because bun
  // runs the whole directory in one process and every file here claims these
  // globals (stacksjs/stacks#1862).
  configureOrm({ database: DB_PATH })

  await ensureDatabaseConfigLoaded()
  initializeDbConfig({
    app: { env: 'testing' },
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: DB_PATH, prefix: '' } },
    },
  })
}

/** The request shape an action's `handle()` actually touches: `get(key)`. */
function loginRequest(email: string, password: string, remember?: unknown): any {
  const fields: Record<string, unknown> = { email, password, remember }
  return {
    get: (key: string) => fields[key],
    all: () => ({ ...fields }),
  }
}

function registrationRequest(email: string, remember?: unknown): any {
  const fields: Record<string, unknown> = {
    email,
    password: PASSWORD,
    name: 'Remembered Registration',
    remember,
  }
  return {
    get: (key: string) => fields[key],
    all: () => ({ ...fields }),
  }
}

function refreshRequest(refreshToken: string): any {
  return {
    get: (key: string) => key === 'refresh_token' ? refreshToken : undefined,
    validate: async () => {},
  }
}

/** Every `Set-Cookie` on a response, however the runtime chose to store them. */
function setCookies(res: Response): string[] {
  const all = (res.headers as any).getSetCookie?.()
  if (Array.isArray(all) && all.length)
    return all

  const single = res.headers.get('Set-Cookie')
  return single ? [single] : []
}

/**
 * The auth cookie, asserted rather than returned as `undefined`.
 *
 * A helper that hands back `undefined` here turns the failure this file exists
 * to catch into a `TypeError` three lines later, which reads like a broken test
 * rather than a missing cookie. Verified by deleting the `Set-Cookie` from
 * `LoginAction` and re-running: exactly the three cookie tests go red, and they
 * say so.
 */
function authCookieFrom(res: Response): string {
  const name = authCookieName()
  const cookie = setCookies(res).find(c => c.startsWith(`${name}=`))

  expect(cookie, `no \`${name}\` cookie on the response; Set-Cookie was ${JSON.stringify(setCookies(res))}`).toBeDefined()

  return cookie!
}

/** The cookie's value, i.e. what the browser will send back. */
function cookieValue(cookie: string): string {
  return decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1).split(';')[0] ?? '')
}

beforeAll(async () => {
  // Holds `initializeDbConfig`'s process-wide config mutex for this file's
  // lifetime (stacksjs/stacks#1862) - released in afterAll.
  releaseDbConfigLock = await acquireDbConfigLock()
  await forceConfig()

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255),
      email VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      password_changed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    )
  `).execute()

  await ensureFrameworkAuthTables()

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS magic_link_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email VARCHAR(255) NOT NULL,
      user_id INTEGER,
      token VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      consumed_at TIMESTAMP,
      redirect_to VARCHAR(2048),
      site_id INTEGER,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    )
  `).execute()

  const hashed = await makeHash(PASSWORD, { algorithm: 'bcrypt' })
  await db.unsafe(`
    INSERT INTO users (name, email, password, created_at, updated_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `, ['Cookie Proof', EMAIL, hashed]).execute()
})

beforeEach(async () => {
  await forceConfig()
})

afterAll(() => {
  /*
   * Hand back the `configureOrm` override before anything else.
   *
   * It outranks `setConfig()` for the rest of the PROCESS, and `bun test`
   * shares one across every file - so without this, each later file stayed
   * pinned to the database this one owns and then deletes, and failed with
   * `RangeError: Cannot use a closed database` (stacksjs/stacks#2415).
   * Released while the config lock is still held, so nothing observes the
   * gap between letting go and the next file configuring its own.
   */
  releaseOrm()


  if (existsSync(DB_PATH))
    unlinkSync(DB_PATH)
  releaseDbConfigLock?.()
})

describe('POST /login sets the auth cookie (#2306)', () => {
  test('a correct password comes back with exactly the measurement that was missing', async () => {
    const res = await LoginAction.handle(loginRequest(EMAIL, PASSWORD)) as Response

    expect(res.status).toBe(200)

    // The finding was `Set-Cookie count: 0`.
    expect(setCookies(res).length).toBeGreaterThan(0)
    authCookieFrom(res)
  })

  test('the cookie carries the same token the body does, not some other one', async () => {
    // A cookie holding a token the app never minted would pass a source-text
    // contract and fail every request the browser then made.
    const res = await LoginAction.handle(loginRequest(EMAIL, PASSWORD)) as Response
    const body = await res.json() as Record<string, unknown>

    expect(cookieValue(authCookieFrom(res))).toBe(body.access_token)
  })

  test('the cookie is httpOnly, so a page script cannot read the session out', async () => {
    const res = await LoginAction.handle(loginRequest(EMAIL, PASSWORD)) as Response
    const cookie = authCookieFrom(res)

    expect(cookie.toLowerCase()).toContain('httponly')
    expect(cookie.toLowerCase()).toContain('path=/')
    expect(cookie.toLowerCase()).toContain('samesite')
  })

  test('the OAuth2 body is unchanged, so an API client sees exactly what it saw before', async () => {
    const res = await LoginAction.handle(loginRequest(EMAIL, PASSWORD)) as Response
    const body = await res.json() as Record<string, unknown>

    // The reported body keys, all still present.
    for (const key of ['access_token', 'expires_in', 'refresh_token', 'token', 'token_type', 'user'])
      expect(body).toHaveProperty(key)

    expect(body.token_type).toBe('Bearer')
    // The legacy field still shadows the access token for un-updated clients.
    expect(body.token).toBe(body.access_token)
  })

  test.each([
    { remember: false, expectedSeconds: 120 },
    { remember: 'on', expectedSeconds: 300 },
  ])('binds the $expectedSeconds second token and cookie lifetime to remember=$remember', async ({ remember, expectedSeconds }) => {
    const originalPolicy = config.auth.browserSession
    config.auth.browserSession = {
      baselineLifetime: 2 * 60 * 1000,
      rememberedLifetime: 5 * 60 * 1000,
      withRefreshToken: false,
    }
    const issuedAt = new Date('2030-01-02T03:04:05.000Z')
    setSystemTime(issuedAt)

    try {
      const res = await LoginAction.handle(loginRequest(EMAIL, PASSWORD, remember)) as Response
      const body = await res.json() as Record<string, unknown>
      const cookie = authCookieFrom(res)
      const tokenRow = await db.selectFrom('oauth_access_tokens')
        .select(['id', 'expires_at'])
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()
      const refreshRow = await db.selectFrom('oauth_refresh_tokens')
        .select('id')
        .where('access_token_id', '=', tokenRow.id)
        .executeTakeFirst()

      expect(body.expires_in).toBe(expectedSeconds)
      expect(body).not.toHaveProperty('refresh_token')
      expect(cookie).toContain(`Max-Age=${expectedSeconds}`)
      expect(refreshRow).toBeUndefined()
      expect(parseSqlDateTime(tokenRow.expires_at)?.getTime()).toBe(issuedAt.getTime() + expectedSeconds * 1000)
    }
    finally {
      setSystemTime()
      config.auth.browserSession = originalPolicy
    }
  })

  test('a wrong password sets no cookie at all', async () => {
    // The failure that matters is not "no session" but "a session anyway": a
    // 401 that still handed out a usable cookie would be an auth bypass.
    const res = await LoginAction.handle(loginRequest(EMAIL, 'not-the-password')) as Response

    expect(res.status).toBe(401)
    expect(setCookies(res)).toEqual([])
  })

  test('an unknown account sets no cookie either', async () => {
    const res = await LoginAction.handle(loginRequest('nobody@example.com', PASSWORD)) as Response

    expect(res.status).toBe(401)
    expect(setCookies(res)).toEqual([])
  })
})

describe('POST /auth/refresh keeps token and configured cookie policy aligned (#2795)', () => {
  test('issued lifetime overrides a conflicting configured fallback Max-Age', async () => {
    const originalPolicy = config.auth.browserSession
    const originalCookie = config.auth.cookie
    config.auth.browserSession = {
      baselineLifetime: 2 * 60 * 1000,
      rememberedLifetime: 2 * 60 * 1000,
      withRefreshToken: true,
    }
    config.auth.cookie = { ...originalCookie, name: 'configured_session', maxAge: 900 }

    try {
      const login = await LoginAction.handle(loginRequest(EMAIL, PASSWORD)) as Response
      const loginBody = await login.json() as { refresh_token: string }
      const refreshed = await RefreshTokenAction.handle(refreshRequest(loginBody.refresh_token)) as Response
      const body = await refreshed.json() as { access_token: string, expires_in: number }
      const cookie = setCookies(refreshed).find(value => value.startsWith('configured_session='))

      expect(refreshed.status).toBe(200)
      expect(cookie).toBeDefined()
      expect(cookieValue(cookie!)).toBe(body.access_token)
      expect(body.expires_in).toBe(60 * 60)
      expect(cookie).toContain(`Max-Age=${body.expires_in}`)
      expect(cookie).not.toContain('Max-Age=900')
    }
    finally {
      config.auth.browserSession = originalPolicy
      config.auth.cookie = originalCookie
    }
  })
})

describe('POST /register applies the browser session policy (#2795)', () => {
  test('a remembered fixed session persists and serializes one matching lifetime', async () => {
    const originalPolicy = config.auth.browserSession
    config.auth.browserSession = {
      baselineLifetime: 2 * 60 * 1000,
      rememberedLifetime: 5 * 60 * 1000,
      withRefreshToken: false,
    }
    const issuedAt = new Date('2030-01-02T03:04:05.000Z')
    setSystemTime(issuedAt)

    try {
      const res = await RegisterAction.handle(registrationRequest('remembered-registration@example.com', true)) as Response
      const body = await res.json() as Record<string, unknown>
      const cookie = authCookieFrom(res)
      const tokenRow = await db.selectFrom('oauth_access_tokens')
        .select(['id', 'expires_at'])
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()
      const refreshRow = await db.selectFrom('oauth_refresh_tokens')
        .select('id')
        .where('access_token_id', '=', tokenRow.id)
        .executeTakeFirst()

      expect(res.status).toBe(200)
      expect(body.expires_in).toBe(300)
      expect(body).not.toHaveProperty('refresh_token')
      expect(cookie).toContain('Max-Age=300')
      expect(refreshRow).toBeUndefined()
      expect(parseSqlDateTime(tokenRow.expires_at)?.getTime()).toBe(issuedAt.getTime() + 300_000)
    }
    finally {
      setSystemTime()
      config.auth.browserSession = originalPolicy
    }
  })
})

describe('POST /auth/magic-link/consume applies the browser session policy (#2795)', () => {
  test('a fixed baseline session matches persistence and rejects replay', async () => {
    const originalMagicLink = config.auth.magicLink
    const originalPolicy = config.auth.browserSession
    config.auth.magicLink = { ...originalMagicLink, enabled: true }
    config.auth.browserSession = {
      baselineLifetime: 2 * 60 * 1000,
      rememberedLifetime: 5 * 60 * 1000,
      withRefreshToken: false,
    }
    const issuedAt = new Date('2030-01-02T03:04:05.000Z')
    setSystemTime(issuedAt)

    try {
      const user = await db.selectFrom('users').select(['id', 'email']).where('email', '=', EMAIL).executeTakeFirstOrThrow()
      const raw = 'magic-link-browser-policy-proof'
      const hashed = createHash('sha256').update(raw).digest('hex')
      const now = sqlDateTime(new Date())
      await db.insertInto('magic_link_tokens').values({
        email: String(user.email),
        user_id: Number(user.id),
        token: hashed,
        expires_at: sqlDateTime(new Date(Date.now() + 5 * 60 * 1000)),
        consumed_at: null,
        redirect_to: '/dashboard',
        site_id: null,
        created_at: now,
        updated_at: now,
      }).execute()

      const request = { get: (key: string) => key === 'token' ? raw : undefined } as any
      const res = await MagicLinkConsumeAction.handle(request) as Response
      const body = await res.json() as Record<string, unknown>
      const tokenRow = await db.selectFrom('oauth_access_tokens')
        .select(['id', 'expires_at'])
        .orderBy('id', 'desc')
        .executeTakeFirstOrThrow()
      const refreshRow = await db.selectFrom('oauth_refresh_tokens')
        .select('id')
        .where('access_token_id', '=', tokenRow.id)
        .executeTakeFirst()

      expect(res.status).toBe(200)
      expect(body.expires_in).toBe(120)
      expect(body).not.toHaveProperty('refresh_token')
      expect(authCookieFrom(res)).toContain('Max-Age=120')
      expect(refreshRow).toBeUndefined()
      expect(parseSqlDateTime(tokenRow.expires_at)?.getTime()).toBe(issuedAt.getTime() + 120_000)

      const replay = await MagicLinkConsumeAction.handle(request) as Response
      expect(replay.status).toBe(401)
      expect(setCookies(replay)).toEqual([])
    }
    finally {
      setSystemTime()
      config.auth.magicLink = originalMagicLink
      config.auth.browserSession = originalPolicy
    }
  })
})

describe('POST /logout serves browser and API clients (#2795)', () => {
  async function issuedToken(): Promise<string> {
    const login = await LoginAction.handle(loginRequest(EMAIL, PASSWORD)) as Response
    return String((await login.json() as { access_token: string }).access_token)
  }

  async function logout(token: string, accept: string, withCsrf = true): Promise<Response> {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.post('/logout-proof', LogoutAction).middleware('auth')
    const cookies = [authCookie(token).split(';')[0]!]
    const headers: Record<string, string> = { accept }
    if (withCsrf) {
      cookies.push(`X-CSRF-Token=${CSRF_TOKEN}`)
      headers['x-csrf-token'] = CSRF_TOKEN
    }
    headers.cookie = cookies.join('; ')

    return router.handleRequest(new Request('https://app.example/logout-proof', {
      method: 'POST',
      headers,
    }))
  }

  test('CSRF rejection leaves the session usable', async () => {
    const token = await issuedToken()
    const res = await logout(token, 'application/json', false)

    expect(res.status).toBe(403)
    expect(await Auth.getUserFromToken(token)).toBeDefined()
  })

  test('HTML CSRF rejection never redirects or revokes', async () => {
    const originalPolicy = config.auth.browserSession
    config.auth.browserSession = { ...originalPolicy, logoutRedirect: '/signed-out' }

    try {
      const token = await issuedToken()
      const res = await logout(token, 'text/html', false)

      expect(res.status).toBe(403)
      expect(res.headers.get('Location')).toBeNull()
      expect(await Auth.getUserFromToken(token)).toBeDefined()
    }
    finally { config.auth.browserSession = originalPolicy }
  })

  test('unauthenticated HTML requests never reach the configured redirect', async () => {
    const originalPolicy = config.auth.browserSession
    config.auth.browserSession = { ...originalPolicy, logoutRedirect: '/signed-out' }

    try {
      const router = createStacksRouter({ autoDiscoverRoutes: false })
      router.post('/logout-proof', LogoutAction).middleware('auth')
      const res = await router.handleRequest(new Request('https://app.example/logout-proof', {
        method: 'POST',
        headers: {
          accept: 'text/html',
          cookie: `X-CSRF-Token=${CSRF_TOKEN}`,
          'x-csrf-token': CSRF_TOKEN,
        },
      }))

      expect(res.status).toBe(401)
      expect(res.headers.get('Location')).toBeNull()
    }
    finally { config.auth.browserSession = originalPolicy }
  })

  test('API logout revokes first, clears the cookie, and returns JSON', async () => {
    const token = await issuedToken()
    const res = await logout(token, 'application/json')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: 'Successfully logged out' })
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0')
    expect(await Auth.getUserFromToken(token)).toBeUndefined()
  })

  test('an API media-range preference remains JSON when HTML is also acceptable', async () => {
    const originalPolicy = config.auth.browserSession
    config.auth.browserSession = { ...originalPolicy, logoutRedirect: '/signed-out' }

    try {
      const token = await issuedToken()
      const res = await logout(token, 'application/*;q=1, text/html;q=0.5')

      expect(res.status).toBe(200)
      expect(res.headers.get('Location')).toBeNull()
      expect(await res.json()).toEqual({ message: 'Successfully logged out' })
      expect(await Auth.getUserFromToken(token)).toBeUndefined()
    }
    finally { config.auth.browserSession = originalPolicy }
  })

  test('HTML logout revokes first, clears the cookie, and uses the configured local redirect', async () => {
    const originalPolicy = config.auth.browserSession
    config.auth.browserSession = { ...originalPolicy, logoutRedirect: '/signed-out?logout=1' }

    try {
      const token = await issuedToken()
      const res = await logout(token, 'text/html,application/xhtml+xml')

      expect(res.status).toBe(303)
      expect(res.headers.get('Location')).toBe('/signed-out?logout=1')
      expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0')
      expect(await Auth.getUserFromToken(token)).toBeUndefined()
    }
    finally { config.auth.browserSession = originalPolicy }
  })
})
