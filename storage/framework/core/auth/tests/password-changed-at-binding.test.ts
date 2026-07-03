/**
 * stacksjs/stacks#1957 — token validity is bound to the user's
 * credential state. A token (access or refresh) issued before the user
 * last changed their password is rejected at USE time, not merely by the
 * post-reset revocation sweep (#1947). This is what closes the race
 * where a refresh exchange rotates itself straight through a password
 * reset: even a freshly minted pair the sweep never saw is killed on
 * first use because its created_at predates users.password_changed_at.
 *
 * Boot pattern mirrors password-reset-revocation.test.ts: env pins run
 * before any framework module loads so the lazy `db` proxy resolves to a
 * throwaway SQLite file; `beforeAll` re-forces the config. The users
 * table here INCLUDES password_changed_at (the new defensive column).
 *
 * Stamps use ±1h offsets, never the same second, to stay clear of
 * CURRENT_TIMESTAMP's one-second granularity and any clock skew.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const DB_PATH = join(tmpdir(), `stacks-1957-binding-${process.pid}.sqlite`)
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
const { makeHash } = await import('@stacksjs/security')

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

async function setStamp(userId: number, sqlExpr: string): Promise<void> {
  await db.unsafe(`UPDATE users SET password_changed_at = ${sqlExpr} WHERE id = ?`, [userId]).execute()
}

// Re-pin the lazy `db` proxy to THIS file's SQLite path before EVERY test.
// Two independent forces of the shared `db` singleton make this necessary:
//
//   1. @stacksjs/database kicks off a fire-and-forget background config
//      reload at module load (`ensureConfigLoaded()`); when it resolves it
//      calls `initializeDbConfig(realAppConfig)` and re-points the proxy at
//      the app's own sqlite file. If that promise settles MID-TEST (this
//      file's reset path does bcrypt + a transaction, a wide async window),
//      it clobbers our test DB and the credential-version stamp lands in the
//      wrong file — the binding assertion then sees a NULL stamp and the
//      pre-change token survives. `await ensureDatabaseConfigLoaded()` first
//      drains that one-shot reload so it can never fire again after we force.
//   2. bun runs every test file of a directory in one process sharing the
//      same singleton, so a sibling file's hooks (e.g.
//      password-reset-revocation.test.ts, a DIFFERENT sqlite file WITHOUT
//      password_changed_at) can win the connection between tests. The
//      `acquireDbConfigLock()` mutex (held for this file's whole lifetime,
//      see `beforeAll`/`afterAll` below) is what actually closes this: no
//      sibling file's `initializeDbConfig` can run while we hold it. The
//      per-test `forceConfig()` stays as defense-in-depth against the
//      background reload in point 1, which the lock doesn't cover.
//
// Forcing AFTER the drain, before every test, makes this file the last
// writer for its own tests regardless of ordering or async timing.
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
  await forceConfig()

  // users INCLUDES password_changed_at — the new credential-version column.
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

describe('token validity bound to password_changed_at (#1957)', () => {
  test('stamp in the FUTURE invalidates a pre-existing token (access + refresh)', async () => {
    const userId = await seedUser('future-stamp@example.com', 'pw-123')
    const pair = await createToken(userId, 'session')

    // Token is valid before any stamp.
    expect(await findToken(pair.plainTextToken)).not.toBeNull()
    expect(await validateRefreshToken(pair.refreshToken!)).toBe(true)

    // Move the stamp 1h ahead of the token's created_at.
    await setStamp(userId, `datetime('now','+1 hour')`)

    expect(await findToken(pair.plainTextToken)).toBeNull()
    expect(refreshToken(pair.refreshToken!)).rejects.toThrow('Invalid or expired refresh token')
  })

  test('stamp in the PAST leaves a later-minted token valid', async () => {
    const userId = await seedUser('past-stamp@example.com', 'pw-123')
    await setStamp(userId, `datetime('now','-1 hour')`)

    const pair = await createToken(userId, 'session')
    expect(await findToken(pair.plainTextToken)).not.toBeNull()
    expect(await validateRefreshToken(pair.refreshToken!)).toBe(true)
    // A refresh exchange succeeds and yields a usable new pair.
    const rotated = await refreshToken(pair.refreshToken!)
    expect(await findToken(rotated.plainTextToken)).not.toBeNull()
  })

  test('NULL stamp (legacy / un-migrated) leaves tokens valid', async () => {
    const userId = await seedUser('null-stamp@example.com', 'pw-123')
    const pair = await createToken(userId, 'session')
    // No stamp set — column is NULL.
    expect(await findToken(pair.plainTextToken)).not.toBeNull()
    expect(await validateRefreshToken(pair.refreshToken!)).toBe(true)
  })

  test('THE RACE: post-reset, an UN-revoked leftover pair is still rejected at use-time', async () => {
    const email = 'race@example.com'
    const userId = await seedUser(email, 'pw-123')
    const pair = await createToken(userId, 'attacker-session')

    // Backdate the leftover pair's created_at a full hour before the reset.
    // createToken stamps created_at with CURRENT_TIMESTAMP (one-second
    // granularity) and resetPassword stamps password_changed_at with
    // formatDate(now) (also one-second). Minted and reset in the same wall
    // clock second, created_at == password_changed_at and the deliberately
    // strict `<` in isIssuedBeforePasswordChange (so a same-second post-reset
    // login is NOT bricked) leaves the token valid — a real same-second tie,
    // not a production bug. Pinning the pair an hour in the past models the
    // actual race (a token issued BEFORE the reset) and is granularity- and
    // skew-proof, matching the ±1h discipline the rest of this file uses.
    await db.unsafe(
      `UPDATE oauth_access_tokens SET created_at = datetime('now','-1 hour') WHERE user_id = ?`,
      [userId],
    ).execute()
    await db.unsafe(`
      UPDATE oauth_refresh_tokens SET created_at = datetime('now','-1 hour')
      WHERE access_token_id IN (SELECT id FROM oauth_access_tokens WHERE user_id = ?)
    `, [userId]).execute()

    const plainResetToken = 'reset-token-1957-race'
    await seedResetRow(email, plainResetToken)
    const result = await passwordResets(email).resetPassword(plainResetToken, 'brand-new-pw-456')
    expect(result.success).toBe(true)

    // Simulate the freshly minted pair the post-commit sweep never saw:
    // manually un-revoke every token row for the user. Validity must NOT
    // depend on the sweep — the created_at-vs-stamp binding kills them.
    await db.unsafe(`UPDATE oauth_access_tokens SET revoked = 0 WHERE user_id = ?`, [userId]).execute()
    await db.unsafe(`
      UPDATE oauth_refresh_tokens SET revoked = 0
      WHERE access_token_id IN (SELECT id FROM oauth_access_tokens WHERE user_id = ?)
    `, [userId]).execute()

    expect(await findToken(pair.plainTextToken)).toBeNull()
    expect(refreshToken(pair.refreshToken!)).rejects.toThrow('Invalid or expired refresh token')
  })

  test('resetPassword stamps the column and a freshly minted post-reset token is valid', async () => {
    const email = 'post-reset@example.com'
    const userId = await seedUser(email, 'pw-123')

    const plainResetToken = 'reset-token-1957-post'
    await seedResetRow(email, plainResetToken)
    const result = await passwordResets(email).resetPassword(plainResetToken, 'brand-new-pw-789')
    expect(result.success).toBe(true)

    const rows = await db.unsafe(`SELECT password_changed_at FROM users WHERE id = ?`, [userId]).execute()
    expect((rows as any[])[0].password_changed_at).not.toBeNull()

    // A token minted AFTER the reset (its created_at >= the stamp) is valid.
    const fresh = await createToken(userId, 'post-reset-session')
    expect(await findToken(fresh.plainTextToken)).not.toBeNull()
  })

  test('graceful degradation: users table WITHOUT the column — findToken works, reset succeeds', async () => {
    // Recreate users without password_changed_at to mimic an un-migrated DB.
    await db.unsafe('DROP TABLE users').execute()
    await db.unsafe(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255),
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )
    `).execute()

    try {
      const email = 'legacy@example.com'
      const userId = await seedUser(email, 'pw-123')
      const pair = await createToken(userId, 'legacy-session')

      // Missing column => getPasswordChangedAt returns null => legacy-allow.
      expect(await findToken(pair.plainTextToken)).not.toBeNull()

      const plainResetToken = 'reset-token-1957-legacy'
      await seedResetRow(email, plainResetToken)
      const result = await passwordResets(email).resetPassword(plainResetToken, 'brand-new-pw-000')
      // Account recovery must not break on an un-migrated DB.
      expect(result.success).toBe(true)
    }
    finally {
      await db.unsafe('DROP TABLE users').execute()
      await db.unsafe(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(255),
          email VARCHAR(255) NOT NULL,
          password VARCHAR(255) NOT NULL,
          password_changed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP
        )
      `).execute()
    }
  })
})
