/**
 * Signing out must take the refresh token with it (stacksjs/stacks#2306).
 *
 * The cascade used to live inline in `logout()`, which only ran for a request
 * carrying an Authorization header. Every other revoke path - `logoutCookie()`
 * above all, and "sign out everywhere" - revoked the access token and left the
 * paired refresh token alive, so a refresh that leaked before the sign-out
 * could still be exchanged for a fresh access token afterwards. Signing out is
 * the one action a person takes *because* they think something is wrong, and it
 * was the action that did not close the hole.
 *
 * #2308 moved the cascade into `Auth.revokeToken()` so every caller gets it.
 * These tests pin that: each of the three revoke entry points, checked against
 * the `oauth_refresh_tokens` row rather than against how the cascade is
 * written.
 *
 * They could not run when they were written. `Auth` resolved to a plain object
 * with no static methods in a whole-directory run, because `register.test.ts`
 * left `../src/authentication` mocked on the way out and `mock.module` is
 * process-wide (stacksjs/stacks#2309). The file was dropped rather than land
 * red; this is it restored, with that mock now captured and put back.
 *
 * They boot the real query builder against a throwaway SQLite file, following
 * `password-reset-revocation.test.ts` - the schema comes from the migrator, not
 * from a fourth hand-written copy of it.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const DB_PATH = join(tmpdir(), `stacks-2306-cascade-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'testing'

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const { ensureFrameworkAuthTables } = await import('./helpers/auth-schema')
const { createToken } = await import('../src/tokens')
const { Auth } = await import('../src/authentication')

const USER_ID = 4242
const OTHER_USER_ID = 4343

/**
 * Re-pin the lazy `db` proxy to THIS file's SQLite path. Two forces move the
 * shared singleton: `@stacksjs/database` kicks off a background config reload
 * at module load, and bun runs a whole directory in one process, so a sibling
 * file's hooks can win the connection between our tests. Draining the one-shot
 * reload first means it cannot fire again after we force.
 */
async function forceConfig(): Promise<void> {
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({
    app: { env: 'testing' },
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: DB_PATH, prefix: '' } },
    },
  })
}

/** Is the refresh token paired with this access token still usable? */
async function refreshTokenLiveFor(accessTokenId: number): Promise<boolean> {
  const rows = await db.unsafe(
    `SELECT revoked FROM oauth_refresh_tokens WHERE access_token_id = ? LIMIT 1`,
    [accessTokenId],
  ).execute()

  const row = (rows as any[])[0]
  expect(row).toBeDefined()

  return !row.revoked
}

async function accessTokenLive(accessTokenId: number): Promise<boolean> {
  const rows = await db.unsafe(
    `SELECT revoked FROM oauth_access_tokens WHERE id = ? LIMIT 1`,
    [accessTokenId],
  ).execute()

  return !(rows as any[])[0]?.revoked
}

let releaseDbConfigLock: () => void

beforeAll(async () => {
  // Holds `initializeDbConfig`'s process-wide config mutex for this file's
  // lifetime (stacksjs/stacks#1862) - released in afterAll.
  releaseDbConfigLock = await acquireDbConfigLock()
  await forceConfig()

  // Seeds the personal access client `createToken()` requires, too.
  await ensureFrameworkAuthTables()
})

beforeEach(async () => {
  await forceConfig()
})

afterAll(() => {
  if (existsSync(DB_PATH))
    unlinkSync(DB_PATH)
  releaseDbConfigLock?.()
})

describe('revoking an access token revokes the refresh token paired with it (#2306)', () => {
  test('revokeToken() cascades, so a leaked refresh cannot outlive the sign-out', async () => {
    const session = await createToken(USER_ID, 'cascade-bearer', ['*'], { withRefreshToken: true })
    const id = Number(session.accessToken.id)

    expect(await refreshTokenLiveFor(id)).toBe(true)

    await Auth.revokeToken(session.plainTextToken)

    expect(await accessTokenLive(id)).toBe(false)
    expect(await refreshTokenLiveFor(id)).toBe(false)
  })

  test('revokeTokenById() cascades, which is the cookie sign-out path', async () => {
    // `logoutCookie()` has no plain token to hash - it holds the row id. This
    // is the path that was leaving refresh tokens alive.
    const session = await createToken(USER_ID, 'cascade-by-id', ['*'], { withRefreshToken: true })
    const id = Number(session.accessToken.id)

    await Auth.revokeTokenById(id)

    expect(await accessTokenLive(id)).toBe(false)
    expect(await refreshTokenLiveFor(id)).toBe(false)
  })

  test('revokeAllTokens() cascades across every session, and stops at the user', async () => {
    const first = await createToken(USER_ID, 'cascade-all-1', ['*'], { withRefreshToken: true })
    const second = await createToken(USER_ID, 'cascade-all-2', ['*'], { withRefreshToken: true })
    const stranger = await createToken(OTHER_USER_ID, 'cascade-other', ['*'], { withRefreshToken: true })

    await Auth.revokeAllTokens(USER_ID)

    for (const session of [first, second]) {
      const id = Number(session.accessToken.id)
      expect(await accessTokenLive(id)).toBe(false)
      expect(await refreshTokenLiveFor(id)).toBe(false)
    }

    // "Sign out everywhere" means everywhere for one account, not everyone.
    const strangerId = Number(stranger.accessToken.id)
    expect(await accessTokenLive(strangerId)).toBe(true)
    expect(await refreshTokenLiveFor(strangerId)).toBe(true)
  })
})
