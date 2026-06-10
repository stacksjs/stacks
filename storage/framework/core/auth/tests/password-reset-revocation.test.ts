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

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const DB_PATH = join(tmpdir(), `stacks-1947-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'testing'

const { db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const { createToken, findToken, refreshToken, validateRefreshToken } = await import('../src/tokens')
const { passwordResets } = await import('../src/password/reset')
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

beforeAll(async () => {
  // Wait for the one-shot async config reload, then force our temp
  // SQLite config so it can't be clobbered (see header comment).
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({
    app: { env: 'testing' },
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: DB_PATH, prefix: '' } },
    },
  })

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

  // createToken() requires a personal-access client.
  await db.unsafe(`
    INSERT INTO oauth_clients (name, secret, provider, redirect, personal_access_client, password_client, revoked, created_at)
    VALUES (?, ?, ?, ?, 1, 0, 0, datetime('now'))
  `, ['Personal Access Client', 'test-secret', 'local', 'http://localhost']).execute()
})

afterAll(() => {
  if (existsSync(DB_PATH))
    unlinkSync(DB_PATH)
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
