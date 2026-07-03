/**
 * Regression tests for stacksjs/stacks#1947 — a successful password
 * reset must revoke EVERY outstanding access token and refresh token
 * for the account.
 *
 * Before the fix, `resetPassword()` updated `users.password` and
 * deleted the `password_resets` row but never touched
 * `oauth_access_tokens` / `oauth_refresh_tokens`. The `/auth/refresh`
 * exchange checks only the refresh row's own `revoked` flag, so a
 * stolen refresh token kept rotating itself into fresh access tokens
 * for up to 30 days after the victim "secured" the account.
 *
 * Strategy: unlike `tokens.test.ts` (deliberately signature-only),
 * these tests boot the real query builder against a throwaway SQLite
 * file. The env pins below run before any framework module loads so
 * the lazy `db` proxy resolves to the temp database; `beforeAll`
 * re-forces the config because bun runs every test file of a
 * directory in one process and an earlier file may already have
 * triggered the async config reload with different settings
 * (bun-query-builder reads its config singleton at query time and
 * reconnects when the connection signature changes, so the late
 * override is reliable).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const DB_PATH = join(tmpdir(), `stacks-1947-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'testing'

// ─── Email stub ─────────────────────────────────────────────────────────
// resetPassword() fires sendPasswordChangedNotification() fire-and-forget
// (reset.ts intentionally does not await it). Since template() resolves the
// framework-shipped defaults (stacksjs/stacks#1944), that dangling promise
// performs a real stx render — slow enough to cross the file boundary and
// land in a LATER file's email mock (bun runs the whole directory in one
// process; prebaked-mailers.test.ts records every mail.send it sees). Stub
// the email namespace with instant fakes so the notification settles within
// this file; nothing here asserts on the email itself. Capture the real
// namespace and restore it in afterAll — mock.module is process-wide.
const realEmail = { ...await import('@stacksjs/email') }
mock.module('@stacksjs/email', () => ({
  ...realEmail,
  template: async () => ({ html: '<p>x</p>', text: 'x' }),
  mail: { send: async () => {} },
}))

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const { createToken, findToken, refreshToken, validateRefreshToken } = await import('../src/tokens')
const { passwordResets } = await import('../src/password/reset')
const { sessionCheck } = await import('../src/session-auth')
const { makeHash, verifyHash } = await import('@stacksjs/security')

const VICTIM_EMAIL = 'victim-1947@example.com'
const CONTROL_EMAIL = 'control-1947@example.com'

async function seedUser(email: string, password: string): Promise<number> {
  const hashed = await makeHash(password, { algorithm: 'bcrypt' })
  await db.unsafe(`
    INSERT INTO users (name, email, password, created_at, updated_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `, ['Test User', email, hashed]).execute()

  const rows = await db.unsafe(`
    SELECT id FROM users WHERE email = ? LIMIT 1
  `, [email]).execute()
  return Number((rows as any[])[0].id)
}

async function seedResetRow(email: string, plainToken: string): Promise<void> {
  const hashedToken = await makeHash(plainToken, { algorithm: 'bcrypt' })
  const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString()
  await db.unsafe(`
    INSERT INTO password_resets (email, token, expires_at, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `, [email, hashedToken, expiresAt]).execute()
}

// Mirrors the row `sessionLogin()` writes (session-auth.ts) without
// pulling the User model into this stripped test environment.
async function seedSessionRow(userId: number, sessionId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString()
  await db.unsafe(`
    INSERT INTO sessions (id, user_id, ip_address, user_agent, payload, last_activity, expires_at)
    VALUES (?, ?, NULL, NULL, '{}', ?, ?)
  `, [sessionId, userId, Math.floor(Date.now() / 1000), expiresAt]).execute()
}

// Re-pin the lazy `db` proxy to THIS file's SQLite path before every test.
// Two independent forces of the shared `db` singleton make this necessary:
//
//   1. @stacksjs/database kicks off a fire-and-forget background config
//      reload at module load (`ensureConfigLoaded()`); when it resolves it
//      re-points the proxy at the app's own sqlite file. If that promise
//      settles MID-TEST (the reset path does bcrypt + a transaction), it
//      clobbers our temp DB. `await ensureDatabaseConfigLoaded()` drains
//      that one-shot reload first so it can never fire again after we force.
//   2. bun runs every test file of a directory in one process sharing the
//      same singleton, so a sibling file's hooks (e.g.
//      password-changed-at-binding.test.ts, a DIFFERENT sqlite file) can win
//      the connection between our tests and route our queries to its DB.
//
// Forcing AFTER the drain, before every test, keeps this file pinned to its
// own schema regardless of cross-file ordering or async timing.
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

beforeEach(async () => {
  await forceConfig()
})

// Holds `initializeDbConfig`'s process-wide config mutex for this file's
// entire lifetime (stacksjs/stacks#1862) — released in `afterAll` below.
let releaseDbConfigLock: () => void

beforeAll(async () => {
  releaseDbConfigLock = await acquireDbConfigLock()

  // Drain the one-shot async config reload, then force our temp SQLite
  // config so it can't be clobbered (see comment above).
  await forceConfig()

  // Minimal schema: just the five tables the reset + token paths touch.
  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255),
      email VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    )
  `).execute()

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email VARCHAR(255) NOT NULL,
      token VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).execute()

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS oauth_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL,
      secret VARCHAR(100),
      provider VARCHAR(255),
      redirect VARCHAR(2000) NOT NULL,
      personal_access_client BOOLEAN NOT NULL DEFAULT 0,
      password_client BOOLEAN NOT NULL DEFAULT 0,
      revoked BOOLEAN NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    )
  `).execute()

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS oauth_access_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      oauth_client_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      name VARCHAR(255),
      scopes TEXT,
      revoked BOOLEAN NOT NULL DEFAULT 0,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    )
  `).execute()

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      access_token_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      revoked BOOLEAN NOT NULL DEFAULT 0,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).execute()

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(255) PRIMARY KEY,
      user_id INTEGER NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      payload TEXT NOT NULL,
      last_activity INTEGER NOT NULL,
      expires_at TIMESTAMP
    )
  `).execute()

  // createToken() requires a personal-access client.
  await db.unsafe(`
    INSERT INTO oauth_clients (name, secret, provider, redirect, personal_access_client, password_client, revoked, created_at)
    VALUES (?, ?, ?, ?, 1, 0, 0, datetime('now'))
  `, ['Personal Access Client', 'test-secret', 'local', 'http://localhost']).execute()
})

afterAll(() => {
  // Restore the real email namespace for later files in this directory run
  // (mock.module is process-wide and bun does not auto-restore it).
  mock.module('@stacksjs/email', () => realEmail)
  if (existsSync(DB_PATH))
    unlinkSync(DB_PATH)
  releaseDbConfigLock?.()
})

describe('password reset revokes all tokens (#1947)', () => {
  test('successful reset revokes every access AND refresh token for the user', async () => {
    const userId = await seedUser(VICTIM_EMAIL, 'original-password-123')

    // Two live sessions: the attacker's stolen one and the victim's own.
    const stolen = await createToken(userId, 'stolen-session')
    const other = await createToken(userId, 'other-session')
    expect(await findToken(stolen.plainTextToken)).not.toBeNull()
    expect(await findToken(other.plainTextToken)).not.toBeNull()
    expect(await validateRefreshToken(stolen.refreshToken!)).toBe(true)
    expect(await validateRefreshToken(other.refreshToken!)).toBe(true)

    const plainResetToken = 'reset-token-1947-victim'
    await seedResetRow(VICTIM_EMAIL, plainResetToken)

    const result = await passwordResets(VICTIM_EMAIL).resetPassword(plainResetToken, 'brand-new-password-123')
    expect(result.success).toBe(true)

    // The core regression: every session is dead, not just the current one.
    expect(await findToken(stolen.plainTextToken)).toBeNull()
    expect(await findToken(other.plainTextToken)).toBeNull()
    expect(await validateRefreshToken(stolen.refreshToken!)).toBe(false)
    expect(await validateRefreshToken(other.refreshToken!)).toBe(false)
  })

  test('post-reset refresh exchange is rejected with 401', async () => {
    // Re-mint then reset again so this test stands on its own state.
    const rows = await db.unsafe(`
      SELECT id FROM users WHERE email = ? LIMIT 1
    `, [VICTIM_EMAIL]).execute()
    const userId = Number((rows as any[])[0].id)

    const stolen = await createToken(userId, 'stolen-session-2')
    const plainResetToken = 'reset-token-1947-victim-2'
    await seedResetRow(VICTIM_EMAIL, plainResetToken)

    const result = await passwordResets(VICTIM_EMAIL).resetPassword(plainResetToken, 'brand-new-password-456')
    expect(result.success).toBe(true)

    // Guards against fixing this with `Auth.revokeAllTokens` (access
    // tokens only): the /auth/refresh exchange checks the refresh
    // row's own `revoked` flag, so it must have been cascaded too.
    expect(refreshToken(stolen.refreshToken!)).rejects.toThrow('Invalid or expired refresh token')
  })

  test('failed reset (wrong token) revokes nothing', async () => {
    const userId = await seedUser(CONTROL_EMAIL, 'control-password-123')
    const session = await createToken(userId, 'control-session')

    await seedResetRow(CONTROL_EMAIL, 'the-real-reset-token')

    const result = await passwordResets(CONTROL_EMAIL).resetPassword('a-wrong-token', 'attacker-password-123')
    expect(result.success).toBe(false)

    expect(await findToken(session.plainTextToken)).not.toBeNull()
    expect(await validateRefreshToken(session.refreshToken!)).toBe(true)
  })

  test('successful reset actually updated the stored password hash', async () => {
    const rows = await db.unsafe(`
      SELECT password FROM users WHERE email = ? LIMIT 1
    `, [VICTIM_EMAIL]).execute()
    const storedHash = String((rows as any[])[0].password)

    expect(await verifyHash('brand-new-password-456', storedHash)).toBe(true)
    expect(await verifyHash('original-password-123', storedHash)).toBe(false)
  })
})

describe('password reset destroys session-auth sessions (#1947)', () => {
  const SESSION_VICTIM_EMAIL = 'session-victim-1947@example.com'
  const SESSION_CONTROL_EMAIL = 'session-control-1947@example.com'

  test('successful reset deletes every session row for the user — and only theirs', async () => {
    const victimId = await seedUser(SESSION_VICTIM_EMAIL, 'victim-password-123')
    const bystanderId = await seedUser(SESSION_CONTROL_EMAIL, 'bystander-password-123')

    // Two live sessions for the victim (attacker's stolen cookie and the
    // victim's own) plus an unrelated user's session that must survive.
    await seedSessionRow(victimId, 'stolen-session-id-1947')
    await seedSessionRow(victimId, 'own-session-id-1947')
    await seedSessionRow(bystanderId, 'bystander-session-id-1947')
    expect(await sessionCheck('stolen-session-id-1947')).toBe(true)
    expect(await sessionCheck('own-session-id-1947')).toBe(true)

    const plainResetToken = 'reset-token-1947-session-victim'
    await seedResetRow(SESSION_VICTIM_EMAIL, plainResetToken)
    const result = await passwordResets(SESSION_VICTIM_EMAIL).resetPassword(plainResetToken, 'brand-new-password-789')
    expect(result.success).toBe(true)

    // The core regression: sessions are validated on row existence +
    // expires_at alone (never re-checked against the password hash), so
    // pre-fix a stolen cookie stayed valid for up to 24h after the reset.
    expect(await sessionCheck('stolen-session-id-1947')).toBe(false)
    expect(await sessionCheck('own-session-id-1947')).toBe(false)
    expect(await sessionCheck('bystander-session-id-1947')).toBe(true)
  })

  test('failed reset (wrong token) destroys no sessions', async () => {
    await seedResetRow(SESSION_CONTROL_EMAIL, 'the-real-session-reset-token')

    const result = await passwordResets(SESSION_CONTROL_EMAIL).resetPassword('a-wrong-token', 'attacker-password-123')
    expect(result.success).toBe(false)

    expect(await sessionCheck('bystander-session-id-1947')).toBe(true)
  })

  test('reset still succeeds when no sessions table exists (default installs)', async () => {
    // No framework migration creates `sessions` — only userland adopting
    // session-auth does. The sweep must treat the missing table as a
    // benign no-op (nothing to revoke), not fail an otherwise-committed
    // reset.
    await db.unsafe('DROP TABLE sessions').execute()
    try {
      const plainResetToken = 'reset-token-1947-no-table'
      await seedResetRow(SESSION_VICTIM_EMAIL, plainResetToken)

      const result = await passwordResets(SESSION_VICTIM_EMAIL).resetPassword(plainResetToken, 'brand-new-password-000')
      expect(result.success).toBe(true)
    }
    finally {
      await db.unsafe(`
        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(255) PRIMARY KEY,
          user_id INTEGER NOT NULL,
          ip_address VARCHAR(45),
          user_agent TEXT,
          payload TEXT NOT NULL,
          last_activity INTEGER NOT NULL,
          expires_at TIMESTAMP
        )
      `).execute()
    }
  })
})
