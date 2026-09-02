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

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
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
const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const { ensureFrameworkAuthTables } = await import('./helpers/auth-schema')
const { makeHash } = await import('@stacksjs/security')
const { authCookieName } = await import('../src/cookie')

const LoginAction = (await import('../../../defaults/app/Actions/Auth/LoginAction')).default

const EMAIL = 'cookie-proof@example.com'
const PASSWORD = 'correct-horse-battery'

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
function loginRequest(email: string, password: string): any {
  const fields: Record<string, string> = { email, password }
  return {
    get: (key: string) => fields[key],
    all: () => ({ ...fields }),
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
