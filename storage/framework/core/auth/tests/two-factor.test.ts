/**
 * stacksjs/status#1 Phase 9 — TOTP 2FA primitives (two-factor.ts).
 *
 * Setup flow: generateTwoFactorSetup() hands back an unpersisted
 * secret; enableTwoFactor() only persists it once the caller proves
 * they saved it to an authenticator app by echoing back a valid code.
 * Login flow: createTwoFactorChallenge()/consumeTwoFactorChallenge()
 * bridge LoginAction (password verified, 2FA pending) and
 * VerifyTwoFactorLoginAction (code verified, tokens minted) — same
 * delete-on-read, single-use shape as passkey.ts's WebAuthn
 * challenges (stacksjs/stacks#1866).
 *
 * Boot pattern mirrors logout-all.test.ts: hand-rolled sqlite schema,
 * no cross-package import of the defaults/app/Actions files.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const DB_PATH = join(tmpdir(), `stacks-status1-two-factor-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'testing'

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const {
  consumePendingTwoFactorSecret,
  consumeTwoFactorChallenge,
  createTwoFactorChallenge,
  disableTwoFactor,
  enableTwoFactor,
  generateTwoFactorSetup,
  getTwoFactorState,
  stashPendingTwoFactorSecret,
  verifyTwoFactorLoginCode,
} = await import('../src/two-factor')
const { generateTwoFactorToken } = await import('../src/authenticator')

async function seedUser(email: string): Promise<number> {
  await db.unsafe(`
    INSERT INTO users (name, email, password, created_at, updated_at)
    VALUES (?, ?, 'hash', datetime('now'), datetime('now'))
  `, ['Test User', email]).execute()
  const rows = await db.unsafe(`SELECT id FROM users WHERE email = ? LIMIT 1`, [email]).execute()
  return Number((rows as any[])[0].id)
}

// Holds `initializeDbConfig`'s process-wide config mutex for this file's
// entire lifetime (stacksjs/stacks#1862) — acquired first thing below in
// `beforeAll`, released last thing in `afterAll` so a sibling test file's
// own `initializeDbConfig` call can't repoint our connection mid-run.
let releaseDbConfigLock: () => void

beforeAll(async () => {
  releaseDbConfigLock = await acquireDbConfigLock()
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({
    app: { env: 'testing' },
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: DB_PATH, prefix: '' } },
    },
  })

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255),
      email VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      two_factor_secret VARCHAR(255),
      two_factor_enabled BOOLEAN NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    )
  `).execute()

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS two_factor_challenges (
      id VARCHAR(255) PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).execute()

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS two_factor_pending_secrets (
      user_id INTEGER PRIMARY KEY,
      secret VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).execute()
})

afterAll(() => {
  if (existsSync(DB_PATH))
    unlinkSync(DB_PATH)
  releaseDbConfigLock?.()
})

describe('TOTP setup + enable/disable', () => {
  test('generateTwoFactorSetup returns a secret and an otpauth:// URI, unpersisted', async () => {
    const userId = await seedUser('setup-unpersisted@example.com')
    const { secret, uri } = generateTwoFactorSetup('setup-unpersisted@example.com', 'Status')

    expect(secret.length).toBeGreaterThan(0)
    expect(uri).toStartWith('otpauth://totp/')

    const state = await getTwoFactorState(userId)
    expect(state.enabled).toBe(false)
    expect(state.secret).toBeNull()
  })

  test('enableTwoFactor rejects an invalid code and does not persist', async () => {
    const userId = await seedUser('enable-invalid@example.com')
    const { secret } = generateTwoFactorSetup('enable-invalid@example.com', 'Status')

    const enabled = await enableTwoFactor(userId, secret, '000000')
    expect(enabled).toBe(false)

    const state = await getTwoFactorState(userId)
    expect(state.enabled).toBe(false)
  })

  test('enableTwoFactor persists the secret and flips two_factor_enabled given a valid code', async () => {
    const userId = await seedUser('enable-valid@example.com')
    const { secret } = generateTwoFactorSetup('enable-valid@example.com', 'Status')
    const code = await generateTwoFactorToken(secret)

    const enabled = await enableTwoFactor(userId, secret, code)
    expect(enabled).toBe(true)

    const state = await getTwoFactorState(userId)
    expect(state.enabled).toBe(true)
    expect(state.secret).toBe(secret)
  })

  test('verifyTwoFactorLoginCode succeeds against the persisted secret, fails for a wrong code', async () => {
    const userId = await seedUser('verify-login-code@example.com')
    const { secret } = generateTwoFactorSetup('verify-login-code@example.com', 'Status')
    const code = await generateTwoFactorToken(secret)
    await enableTwoFactor(userId, secret, code)

    const freshCode = await generateTwoFactorToken(secret)
    expect(await verifyTwoFactorLoginCode(userId, freshCode)).toBe(true)
    expect(await verifyTwoFactorLoginCode(userId, '000000')).toBe(false)
  })

  test('verifyTwoFactorLoginCode is false when 2FA was never enabled', async () => {
    const userId = await seedUser('never-enabled@example.com')
    expect(await verifyTwoFactorLoginCode(userId, '123456')).toBe(false)
  })

  test('disableTwoFactor clears the secret and flag', async () => {
    const userId = await seedUser('disable@example.com')
    const { secret } = generateTwoFactorSetup('disable@example.com', 'Status')
    const code = await generateTwoFactorToken(secret)
    await enableTwoFactor(userId, secret, code)
    expect((await getTwoFactorState(userId)).enabled).toBe(true)

    await disableTwoFactor(userId)
    const state = await getTwoFactorState(userId)
    expect(state.enabled).toBe(false)
    expect(state.secret).toBeNull()
  })
})

describe('pending secret stash (bridges GenerateTwoFactorSecretAction -> EnableTwoFactorAction)', () => {
  test('a stashed secret consumes exactly once', async () => {
    const userId = await seedUser('pending-once@example.com')
    await stashPendingTwoFactorSecret(userId, 'SECRETVALUE1234')

    expect(await consumePendingTwoFactorSecret(userId)).toBe('SECRETVALUE1234')
    expect(await consumePendingTwoFactorSecret(userId)).toBeNull()
  })

  test('an expired pending secret is rejected', async () => {
    const userId = await seedUser('pending-expired@example.com')
    await stashPendingTwoFactorSecret(userId, 'SECRETVALUE1234', -1)

    expect(await consumePendingTwoFactorSecret(userId)).toBeNull()
  })

  test('stashing a new secret for the same user replaces the previous pending one', async () => {
    const userId = await seedUser('pending-replace@example.com')
    await stashPendingTwoFactorSecret(userId, 'FIRSTSECRET1234')
    await stashPendingTwoFactorSecret(userId, 'SECONDSECRET1234')

    expect(await consumePendingTwoFactorSecret(userId)).toBe('SECONDSECRET1234')
  })

  test('a user with no pending secret gets null', async () => {
    const userId = await seedUser('pending-none@example.com')
    expect(await consumePendingTwoFactorSecret(userId)).toBeNull()
  })
})

describe('login challenge (bridges LoginAction -> VerifyTwoFactorLoginAction)', () => {
  test('a fresh challenge consumes exactly once and returns the owning user id', async () => {
    const userId = await seedUser('challenge-once@example.com')
    const token = await createTwoFactorChallenge(userId)

    expect(await consumeTwoFactorChallenge(token)).toBe(userId)
    // Second consume of the same token: already deleted.
    expect(await consumeTwoFactorChallenge(token)).toBeNull()
  })

  test('an expired challenge is rejected even before being explicitly consumed', async () => {
    const userId = await seedUser('challenge-expired@example.com')
    const token = await createTwoFactorChallenge(userId, -1) // already-expired TTL

    expect(await consumeTwoFactorChallenge(token)).toBeNull()
  })

  test('creating a new challenge for the same user invalidates the previous one', async () => {
    const userId = await seedUser('challenge-replace@example.com')
    const first = await createTwoFactorChallenge(userId)
    const second = await createTwoFactorChallenge(userId)

    expect(await consumeTwoFactorChallenge(first)).toBeNull()
    expect(await consumeTwoFactorChallenge(second)).toBe(userId)
  })

  test('consuming an unknown token returns null', async () => {
    expect(await consumeTwoFactorChallenge('not-a-real-token')).toBeNull()
  })
})
