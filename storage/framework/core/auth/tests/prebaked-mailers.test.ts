/**
 * Tests for stacksjs/stacks#1944 — standardized prebaked reset /
 * verification mailers:
 *
 *   1. Anti-enumeration: `passwordResets(email).sendEmail()` is a silent
 *      no-op for unregistered emails (no token row, no send) so callers
 *      can always answer "if an account exists, we sent a link".
 *   2. Configurable URLs: `config.auth.passwordReset.url` with
 *      `{token}`/`{email}` placeholders and
 *      `config.auth.emailVerification.url` with `{id}`/`{token}`.
 *      Absolute templates pass through; paths are prefixed with the
 *      app URL; `{email}` is URL-encoded.
 *   3. Plain-text fallback: `template()` (in @stacksjs/email) NEVER
 *      throws for a missing template or a failed STX render — it
 *      returns `{ html: '', text: '' }` — so the senders must treat an
 *      empty render as failure and send the plain-text fallback instead
 *      of mailing a blank email with no link. The 'empty render' tests
 *      here are the regression tests for that guard and fail without it.
 *
 * Harness: real query builder against a throwaway SQLite file (the
 * password-reset-revocation.test.ts pattern) + `mock.module` stubs for
 * `@stacksjs/email` only (the register.test.ts pattern — capture the
 * real namespace with spread and restore in afterAll, because
 * `mock.module` is process-wide and bun runs the whole directory in one
 * process).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const DB_PATH = join(tmpdir(), `stacks-1944-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'testing'

// ─── @stacksjs/email stubs (must precede the SUT imports) ───────────

interface SentMail {
  to: string
  subject: string
  text?: string
  html?: string
}

const sent: SentMail[] = []
let templateMode: 'ok' | 'throw' | 'empty' = 'ok'
let mailMode: 'ok' | 'throw' = 'ok'
let lastTemplateVars: Record<string, unknown> | null = null

// Capture the real namespace with spread BEFORE mocking — mocking
// patches the live namespace in place, so a bare capture would
// "restore" the mock itself.
const realEmail = { ...await import('@stacksjs/email') }

mock.module('@stacksjs/email', () => ({
  ...realEmail,
  template: async (_name: string, options?: { variables?: Record<string, unknown> }) => {
    lastTemplateVars = options?.variables ?? null
    if (templateMode === 'throw')
      throw new Error('template engine failure')
    if (templateMode === 'empty') {
      // The REAL contract of template() for a missing template or a
      // failed STX render: warn + empty strings, never a throw.
      return { html: '', text: '' }
    }
    return { html: '<p>x</p>', text: 'x' }
  },
  mail: {
    send: async (message: SentMail) => {
      if (mailMode === 'throw')
        throw new Error('mail driver failure')
      sent.push(message)
      return { success: true }
    },
  },
}))

const { db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const { overrides, overridesReady } = await import('@stacksjs/config')
const { passwordResets } = await import('../src/password/reset')
const { sendVerificationEmail } = await import('../src/email-verification')
const { verifyHash } = await import('@stacksjs/security')

const KNOWN_EMAIL = 'known-1944@example.com'
const TAGGED_EMAIL = 'tagged+user-1944@example.com'
const VERIFY_EMAIL = 'verify-1944@example.com'
const CHANGED_EMAIL = 'changed-1944@example.com'

// Originals to restore in afterAll — `overrides` is a globalThis-anchored
// singleton mutated in place, so leaking pinned values would poison every
// later test file in the directory run.
let originalApp: Record<string, unknown>
let originalAuth: Record<string, unknown>

async function seedUser(email: string): Promise<number> {
  await db.unsafe(`
    INSERT INTO users (name, email, password, created_at, updated_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `, ['Test User', email, 'irrelevant-hash']).execute()

  const rows = await db.unsafe(`
    SELECT id FROM users WHERE email = ? LIMIT 1
  `, [email]).execute()
  return Number((rows as any[])[0].id)
}

async function resetRowsFor(email: string): Promise<any[]> {
  return await db.unsafe(`
    SELECT * FROM password_resets WHERE email = ?
  `, [email]).execute() as any[]
}

function extractToken(url: string): string {
  const match = url.match(/[0-9a-f]{64}/)
  if (!match)
    throw new Error(`no 64-hex token in url: ${url}`)
  return match[0]
}

beforeAll(async () => {
  // Wait for the one-shot async config reload, then force our temp
  // SQLite config so an earlier test file's settings can't clobber it.
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

  // Sqlite shape from actions/src/auth/setup.ts.
  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).execute()

  // resetPassword()'s post-commit revocation (revokeAllTokens →
  // revokeAllRefreshTokens) runs raw UPDATEs against these two tables
  // and throws if they're missing; sessions is needed by
  // sessionDestroyAll (which tolerates absence, but creating it keeps
  // this file independent of that tolerance). Shapes from
  // password-reset-revocation.test.ts.
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

  // Pin app config AFTER the user-config load resolves (otherwise the
  // background loader clobbers the pin). readMerged() returns the
  // overrides section WHOLESALE when non-empty, so spread the captured
  // real object — replacing it outright would drop keys other code
  // reads during the run. `key` is required by the email-verification
  // HMAC; `url` makes the URL assertions deterministic.
  //
  // overridesReady REJECTS when the boot validator trips on test env
  // pins (APP_ENV=testing is not in the allowed enum) — but the user
  // configs were already merged into the globalThis-anchored
  // `overrides` object before validation ran, so swallow the rejection
  // and read the populated object directly.
  await overridesReady.catch(() => {})
  originalApp = (overrides as any).app
  originalAuth = (overrides as any).auth
  ;(overrides as any).app = {
    ...originalApp,
    url: 'example.test',
    key: (originalApp as any)?.key || 'test-key-1944',
  }

  await seedUser(KNOWN_EMAIL)
  await seedUser(TAGGED_EMAIL)
  await seedUser(VERIFY_EMAIL)
  await seedUser(CHANGED_EMAIL)
})

beforeEach(() => {
  sent.length = 0
  templateMode = 'ok'
  mailMode = 'ok'
  lastTemplateVars = null
  // Restore the full (non-empty) userland auth object between tests —
  // an empty overrides.auth would fall through to framework defaults.
  ;(overrides as any).auth = { ...originalAuth }
})

afterAll(async () => {
  mock.module('@stacksjs/email', () => realEmail)
  ;(overrides as any).app = originalApp
  ;(overrides as any).auth = originalAuth
  if (existsSync(DB_PATH))
    unlinkSync(DB_PATH)
})

describe('password reset anti-enumeration (#1944)', () => {
  test('unknown email is a silent no-op: no token row, no send, no throw', async () => {
    await passwordResets('ghost-1944@example.com').sendEmail()

    expect((await resetRowsFor('ghost-1944@example.com')).length).toBe(0)
    expect(sent.length).toBe(0)
  })

  test('known email writes one row and sends one email whose token matches the stored hash', async () => {
    await passwordResets(KNOWN_EMAIL).sendEmail()

    const rows = await resetRowsFor(KNOWN_EMAIL)
    expect(rows.length).toBe(1)
    expect(sent.length).toBe(1)
    expect(sent[0].to).toBe(KNOWN_EMAIL)

    // The mailed plaintext token must verify against the stored bcrypt hash.
    const resetUrl = String(lastTemplateVars?.resetUrl)
    const mailedToken = extractToken(resetUrl)
    expect(await verifyHash(mailedToken, String(rows[0].token))).toBe(true)
  })

  test('repeat send rotates the token but keeps a single outstanding row', async () => {
    await passwordResets(KNOWN_EMAIL).sendEmail()
    const firstToken = extractToken(String(lastTemplateVars?.resetUrl))

    await passwordResets(KNOWN_EMAIL).sendEmail()
    const secondToken = extractToken(String(lastTemplateVars?.resetUrl))

    const rows = await resetRowsFor(KNOWN_EMAIL)
    expect(rows.length).toBe(1)
    expect(secondToken).not.toBe(firstToken)
    expect(await verifyHash(secondToken, String(rows[0].token))).toBe(true)
    expect(await verifyHash(firstToken, String(rows[0].token))).toBe(false)
  })
})

describe('password reset URL template (#1944)', () => {
  test('default convention URL-encodes {email} (+ and @)', async () => {
    await passwordResets(TAGGED_EMAIL).sendEmail()

    const resetUrl = String(lastTemplateVars?.resetUrl)
    expect(resetUrl).toMatch(
      /^https:\/\/example\.test\/password\/reset\/[0-9a-f]{64}\?email=tagged%2Buser-1944%40example\.com$/,
    )
  })

  test('absolute template is used as-is', async () => {
    ;(overrides as any).auth = {
      ...originalAuth,
      passwordReset: {
        ...(originalAuth as any).passwordReset,
        url: 'https://accounts.example.com/reset?t={token}&e={email}',
      },
    }

    await passwordResets(KNOWN_EMAIL).sendEmail()

    const resetUrl = String(lastTemplateVars?.resetUrl)
    expect(resetUrl.startsWith('https://accounts.example.com/reset?t=')).toBe(true)
    expect(resetUrl).toContain('e=known-1944%40example.com')
    expect(resetUrl).not.toContain('example.test')
  })

  test('path template without leading slash is prefixed with app URL plus slash', async () => {
    ;(overrides as any).auth = {
      ...originalAuth,
      passwordReset: { ...(originalAuth as any).passwordReset, url: 'custom/reset/{token}' },
    }

    await passwordResets(KNOWN_EMAIL).sendEmail()

    expect(String(lastTemplateVars?.resetUrl)).toMatch(
      /^https:\/\/example\.test\/custom\/reset\/[0-9a-f]{64}$/,
    )
  })

  test('path template with leading slash is prefixed with app URL', async () => {
    ;(overrides as any).auth = {
      ...originalAuth,
      passwordReset: { ...(originalAuth as any).passwordReset, url: '/r/{token}' },
    }

    await passwordResets(KNOWN_EMAIL).sendEmail()

    expect(String(lastTemplateVars?.resetUrl).startsWith('https://example.test/r/')).toBe(true)
  })
})

describe('password reset plain-text fallback (#1944)', () => {
  test('template render throwing → plain-text fallback still delivers the link', async () => {
    templateMode = 'throw'

    await passwordResets(KNOWN_EMAIL).sendEmail()

    expect(sent.length).toBe(1)
    expect(sent[0].html).toBeUndefined()
    const resetUrl = String(lastTemplateVars?.resetUrl)
    expect(sent[0].text).toContain(resetUrl)
    expect(sent[0].text).toContain(`expires in ${lastTemplateVars?.expireMinutes} minutes`)
  })

  test('missing template (empty render, the REAL template() contract) → plain-text fallback, not a blank email', async () => {
    // Regression: template() returns { html: '', text: '' } for a
    // missing template instead of throwing, so without the empty-render
    // guard sendEmail() mails a blank email with no reset link.
    templateMode = 'empty'

    await passwordResets(KNOWN_EMAIL).sendEmail()

    expect(sent.length).toBe(1)
    expect(sent[0].html).toBeUndefined()
    const resetUrl = String(lastTemplateVars?.resetUrl)
    expect(sent[0].text).toContain(resetUrl)
    expect(sent[0].text).toContain(`expires in ${lastTemplateVars?.expireMinutes} minutes`)
  })

  test('hard mail-driver failure still throws', async () => {
    mailMode = 'throw'

    await expect(passwordResets(KNOWN_EMAIL).sendEmail()).rejects.toThrow('mail driver failure')
  })
})

describe('password changed notification fallback (#1944)', () => {
  test('missing template (empty render) → plain-text notification, not a blank email', async () => {
    // Mint a valid token while the template still renders normally…
    await passwordResets(CHANGED_EMAIL).sendEmail()
    const token = extractToken(String(lastTemplateVars?.resetUrl))
    sent.length = 0

    // …then make every render come back empty — the REAL template()
    // contract for a missing 'password-changed' template. Regression
    // for the empty-render guard in sendPasswordChangedNotification():
    // without it the notification goes out as a blank email
    // (html: '', text: '') instead of the plain-text fallback.
    templateMode = 'empty'

    const result = await passwordResets(CHANGED_EMAIL).resetPassword(token, 'brand-new-pass-1944')
    expect(result).toEqual({ success: true })

    // The notification is fire-and-forget (.catch()ed, never awaited by
    // resetPassword), so poll briefly for the send to land.
    for (let i = 0; sent.length === 0 && i < 100; i++)
      await new Promise(resolve => setTimeout(resolve, 5))

    expect(sent.length).toBe(1)
    expect(sent[0].to).toBe(CHANGED_EMAIL)
    expect(sent[0].subject).toContain('password has been changed')
    expect(sent[0].html).toBeUndefined()
    expect(sent[0].text).toContain('password was changed on')
  })
})

describe('email verification URL template + fallback (#1944)', () => {
  async function verifyUserId(): Promise<number> {
    const rows = await db.unsafe(`
      SELECT id FROM users WHERE email = ? LIMIT 1
    `, [VERIFY_EMAIL]).execute()
    return Number((rows as any[])[0].id)
  }

  test('default convention builds /verify-email/{id}/{token} on the app URL', async () => {
    const id = await verifyUserId()
    await sendVerificationEmail({ id, email: VERIFY_EMAIL })

    expect(String(lastTemplateVars?.verificationUrl)).toMatch(
      new RegExp(`^https://example\\.test/verify-email/${id}/[0-9a-f]{64}$`),
    )
    const rows = await db.unsafe(`
      SELECT * FROM email_verifications WHERE user_id = ?
    `, [id]).execute() as any[]
    expect(rows.length).toBe(1)
    expect(sent.length).toBe(1)
    expect(sent[0].to).toBe(VERIFY_EMAIL)
  })

  test('absolute template is used as-is with {id}/{token} substituted', async () => {
    ;(overrides as any).auth = {
      ...originalAuth,
      emailVerification: { url: 'https://auth.example.com/v?u={id}&t={token}' },
    }

    const id = await verifyUserId()
    await sendVerificationEmail({ id, email: VERIFY_EMAIL })

    expect(String(lastTemplateVars?.verificationUrl)).toMatch(
      new RegExp(`^https://auth\\.example\\.com/v\\?u=${id}&t=[0-9a-f]{64}$`),
    )
  })

  test('path template is prefixed with app URL', async () => {
    ;(overrides as any).auth = {
      ...originalAuth,
      emailVerification: { url: 'confirm/{id}/{token}' },
    }

    const id = await verifyUserId()
    await sendVerificationEmail({ id, email: VERIFY_EMAIL })

    expect(String(lastTemplateVars?.verificationUrl).startsWith(`https://example.test/confirm/${id}/`)).toBe(true)
  })

  test('missing template (empty render) → plain-text fallback delivers the link', async () => {
    // Regression: same empty-render guard as the password-reset sender.
    templateMode = 'empty'

    const id = await verifyUserId()
    await sendVerificationEmail({ id, email: VERIFY_EMAIL })

    expect(sent.length).toBe(1)
    expect(sent[0].html).toBeUndefined()
    expect(sent[0].text).toContain(String(lastTemplateVars?.verificationUrl))
  })
})
