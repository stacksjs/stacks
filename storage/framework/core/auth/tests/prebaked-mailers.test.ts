/**
 * Tests for stacksjs/stacks#1944 — the prebaked password-reset and
 * email-verification mailers.
 *
 * Background: commit ec8d4c88b landed the three source changes the issue
 * asked for (anti-enumeration in sendEmail(), configurable URL templates,
 * and a plain-text fallback) but shipped zero tests, and one of the
 * fallbacks was dead code. @stacksjs/email's template() does NOT throw on a
 * missing template — resolveTemplatePath() only consults userland
 * resources/emails (the bundled password-reset.stx / email-verification.stx
 * live under storage/framework/defaults/, which template() never reads) and
 * returns { html: '', text: '' } on a miss. So the try/catch fallbacks never
 * fired and a default install mailed a BLANK reset/verification email.
 *
 * The accompanying source fix treats an empty render as a failure so the
 * plain-text fallback actually fires. These tests cover: anti-enumeration,
 * both URL templates (default / absolute / path), and the fallbacks for
 * both the throwing and empty-render template paths.
 *
 * Test harness mirrors the package's two established patterns:
 *   - password-reset-revocation.test.ts: env pins before any framework
 *     import, real query builder against a throwaway SQLite file, db.unsafe
 *     DDL, ensureDatabaseConfigLoaded + initializeDbConfig.
 *   - register.test.ts: mock.module BEFORE importing the SUT, capture the
 *     real namespace with spread and restore in afterAll because mock.module
 *     is process-wide and bun runs the whole directory in one process.
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
// This file awaits overridesReady to pin config.app/config.auth, which
// triggers boot-time config validation. password-reset-revocation.test.ts
// pins APP_ENV='testing' (not in the validator's allowlist) and other files
// in a directory run may leave partial config; bypass validation so the pin
// doesn't fail on an env value the suite already uses everywhere.
process.env.SKIP_CONFIG_VALIDATION = 'true'

// ─── Email stub ─────────────────────────────────────────────────────────
// Capture the real namespace with spread so afterAll can put it back: bun
// does NOT restore mock.module between files in a directory run, and
// password-reset-revocation.test.ts depends on the real sendPasswordChanged
// path mailing through the real (logging) driver.
const realEmail = { ...await import('@stacksjs/email') }

interface SentMail { to?: string, subject?: string, text?: string, html?: string }
const sent: SentMail[] = []
let templateMode: 'ok' | 'throw' | 'empty' = 'ok'
let mailMode: 'ok' | 'throw' = 'ok'
let lastTemplateVars: Record<string, unknown> | null = null

async function fakeTemplate(_name: string, options?: { variables?: Record<string, unknown> }): Promise<{ html: string, text: string }> {
  lastTemplateVars = options?.variables ?? null
  if (templateMode === 'throw')
    throw new Error('template engine failure')
  if (templateMode === 'empty')
    return { html: '', text: '' } // the REAL missing-template contract
  return { html: '<p>x</p>', text: 'x' }
}

const fakeMail = {
  send: async (msg: SentMail): Promise<void> => {
    if (mailMode === 'throw')
      throw new Error('mail driver failure')
    sent.push({ to: msg.to, subject: msg.subject, text: msg.text, html: msg.html })
  },
}

mock.module('@stacksjs/email', () => ({ ...realEmail, template: fakeTemplate, mail: fakeMail }))

// ─── SUT + collaborators (imported AFTER the mock is installed) ──────────
const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const { overrides, overridesReady } = await import('@stacksjs/config')
const { passwordResets } = await import('../src/password/reset')
const { sendVerificationEmail } = await import('../src/email-verification')
const { verifyHash } = await import('@stacksjs/security')

const KNOWN_EMAIL = 'known-1944@example.com'
const TAGGED_EMAIL = 'tagged+user-1944@example.com'
const VERIFY_EMAIL = 'verify-1944@example.com'

let originalApp: unknown
let originalAuth: unknown
let realAuthCaptured: Record<string, unknown>

async function seedUser(email: string): Promise<number> {
  await db.unsafe(`
    INSERT INTO users (name, email, password, created_at, updated_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `, ['Test User', email, 'x']).execute()
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
    CREATE TABLE IF NOT EXISTS email_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).execute()

  // Pin config AFTER overridesReady so the background user-config load can't
  // clobber it. readMerged returns overrides[prop] WHOLESALE when non-empty,
  // so spread the captured real objects to preserve sibling keys (guards,
  // username, etc.) that other code may read during the test.
  await overridesReady
  originalApp = (overrides as any).app
  originalAuth = (overrides as any).auth
  realAuthCaptured = { ...(overrides as any).auth }
  ;(overrides as any).app = {
    ...(overrides as any).app,
    url: 'example.test',
    // email-verification HMAC requires a real app key (getVerificationKey
    // throws on an empty one).
    key: (overrides as any).app?.key || 'test-key-1944',
  }

  await seedUser(KNOWN_EMAIL)
  await seedUser(TAGGED_EMAIL)
  await seedUser(VERIFY_EMAIL)
})

afterAll(() => {
  // Restore the real email namespace (process-wide mock) and config pins for
  // any later test file in this directory run.
  mock.module('@stacksjs/email', () => realEmail)
  ;(overrides as any).app = originalApp
  ;(overrides as any).auth = originalAuth
  if (existsSync(DB_PATH))
    unlinkSync(DB_PATH)
  releaseDbConfigLock?.()
})

beforeEach(() => {
  sent.length = 0
  templateMode = 'ok'
  mailMode = 'ok'
  lastTemplateVars = null
  // Reset URL-template overrides between tests. Always restore the captured
  // non-empty userland auth object (readMerged falls through to defaults
  // when the object is empty).
  ;(overrides as any).auth = { ...realAuthCaptured }
})

async function resetRowCount(email: string): Promise<number> {
  const rows = await db.unsafe(`SELECT COUNT(*) AS c FROM password_resets WHERE email = ?`, [email]).execute()
  return Number((rows as any[])[0].c)
}

describe('password reset anti-enumeration (#1944)', () => {
  test('unknown email is a silent no-op — no row, no send', async () => {
    await expect(passwordResets('ghost-1944@example.com').sendEmail()).resolves.toBeUndefined()
    expect(await resetRowCount('ghost-1944@example.com')).toBe(0)
    expect(sent.length).toBe(0)
  })

  test('known email writes one row and sends one email with the matching token', async () => {
    await passwordResets(KNOWN_EMAIL).sendEmail()

    expect(await resetRowCount(KNOWN_EMAIL)).toBe(1)
    expect(sent.length).toBe(1)
    expect(sent[0].to).toBe(KNOWN_EMAIL)

    // The plaintext token mailed (embedded in resetUrl) must verify against
    // the stored bcrypt hash.
    const resetUrl = String(lastTemplateVars?.resetUrl)
    const token = resetUrl.replace(/.*\/reset\/([0-9a-f]{64}).*/, '$1')
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    const rows = await db.unsafe(`SELECT token FROM password_resets WHERE email = ? LIMIT 1`, [KNOWN_EMAIL]).execute()
    expect(await verifyHash(token, String((rows as any[])[0].token))).toBe(true)
  })

  test('repeat send rotates the token but keeps exactly one row', async () => {
    await passwordResets(KNOWN_EMAIL).sendEmail()
    const first = String(lastTemplateVars?.resetUrl)
    await passwordResets(KNOWN_EMAIL).sendEmail()
    const second = String(lastTemplateVars?.resetUrl)

    expect(await resetRowCount(KNOWN_EMAIL)).toBe(1)
    expect(first).not.toBe(second)
  })
})

describe('password reset URL template (#1944)', () => {
  test('default convention URL-encodes {email} ( + and @ )', async () => {
    await passwordResets(TAGGED_EMAIL).sendEmail()
    const resetUrl = String(lastTemplateVars?.resetUrl)
    expect(resetUrl).toMatch(
      /^https:\/\/example\.test\/password\/reset\/[0-9a-f]{64}\?email=tagged%2Buser-1944%40example\.com$/,
    )
  })

  test('absolute template is used as-is, not prefixed with the app URL', async () => {
    ;(overrides as any).auth = {
      ...realAuthCaptured,
      passwordReset: { ...(realAuthCaptured as any).passwordReset, url: 'https://accounts.example.com/reset?t={token}&e={email}' },
    }
    await passwordResets(KNOWN_EMAIL).sendEmail()
    const resetUrl = String(lastTemplateVars?.resetUrl)
    expect(resetUrl.startsWith('https://accounts.example.com/reset?t=')).toBe(true)
    expect(resetUrl).toContain('e=known-1944%40example.com')
    expect(resetUrl).not.toContain('example.test')
  })

  test('path template is prefixed with the app URL (slash added when missing)', async () => {
    ;(overrides as any).auth = {
      ...realAuthCaptured,
      passwordReset: { ...(realAuthCaptured as any).passwordReset, url: 'custom/reset/{token}' },
    }
    await passwordResets(KNOWN_EMAIL).sendEmail()
    expect(String(lastTemplateVars?.resetUrl)).toMatch(/^https:\/\/example\.test\/custom\/reset\/[0-9a-f]{64}$/)
  })

  test('leading-slash path template is prefixed with the app URL', async () => {
    ;(overrides as any).auth = {
      ...realAuthCaptured,
      passwordReset: { ...(realAuthCaptured as any).passwordReset, url: '/r/{token}' },
    }
    await passwordResets(KNOWN_EMAIL).sendEmail()
    expect(String(lastTemplateVars?.resetUrl).startsWith('https://example.test/r/')).toBe(true)
  })
})

describe('password reset plain-text fallback (#1944)', () => {
  test('template render throwing → plain-text fallback send', async () => {
    templateMode = 'throw'
    await expect(passwordResets(KNOWN_EMAIL).sendEmail()).resolves.toBeUndefined()
    expect(sent.length).toBe(1)
    expect(sent[0].html).toBeUndefined()
    expect(sent[0].text).toContain('https://example.test/password/reset/')
    expect(sent[0].text).toContain('expires in 60 minutes')
  })

  test('missing template (empty render) → plain-text fallback (regression for the fix)', async () => {
    templateMode = 'empty'
    await expect(passwordResets(KNOWN_EMAIL).sendEmail()).resolves.toBeUndefined()
    expect(sent.length).toBe(1)
    expect(sent[0].html).toBeUndefined()
    expect(sent[0].text).toContain('https://example.test/password/reset/')
    expect(sent[0].text).toContain('expires in 60 minutes')
  })

  test('hard mail-driver failure still throws', async () => {
    mailMode = 'throw'
    await expect(passwordResets(KNOWN_EMAIL).sendEmail()).rejects.toThrow()
  })
})

describe('email verification URL template + fallback (#1944)', () => {
  let verifyId: number

  beforeAll(async () => {
    const rows = await db.unsafe(`SELECT id FROM users WHERE email = ? LIMIT 1`, [VERIFY_EMAIL]).execute()
    verifyId = Number((rows as any[])[0].id)
  })

  async function verifyRowCount(): Promise<number> {
    const rows = await db.unsafe(`SELECT COUNT(*) AS c FROM email_verifications WHERE user_id = ?`, [verifyId]).execute()
    return Number((rows as any[])[0].c)
  }

  test('default convention URL with real id + token', async () => {
    await sendVerificationEmail({ id: verifyId, email: VERIFY_EMAIL })
    const url = String(lastTemplateVars?.verificationUrl)
    expect(url).toMatch(new RegExp(`^https://example\\.test/verify-email/${verifyId}/[0-9a-f]{64}$`))
    expect(await verifyRowCount()).toBe(1)
    expect(sent.length).toBe(1)
    expect(sent[0].to).toBe(VERIFY_EMAIL)
  })

  test('absolute template is used as-is', async () => {
    ;(overrides as any).auth = {
      ...realAuthCaptured,
      emailVerification: { url: 'https://auth.example.com/v?u={id}&t={token}' },
    }
    await sendVerificationEmail({ id: verifyId, email: VERIFY_EMAIL })
    const url = String(lastTemplateVars?.verificationUrl)
    expect(url.startsWith(`https://auth.example.com/v?u=${verifyId}&t=`)).toBe(true)
    expect(url).not.toContain('example.test')
  })

  test('path template is prefixed with the app URL', async () => {
    ;(overrides as any).auth = {
      ...realAuthCaptured,
      emailVerification: { url: 'confirm/{id}/{token}' },
    }
    await sendVerificationEmail({ id: verifyId, email: VERIFY_EMAIL })
    expect(String(lastTemplateVars?.verificationUrl)).toMatch(
      new RegExp(`^https://example\\.test/confirm/${verifyId}/[0-9a-f]{64}$`),
    )
  })

  test('missing template (empty render) → plain-text fallback (regression for the fix)', async () => {
    templateMode = 'empty'
    await sendVerificationEmail({ id: verifyId, email: VERIFY_EMAIL })
    expect(sent.length).toBe(1)
    expect(sent[0].html).toBeUndefined()
    expect(sent[0].text).toContain(`https://example.test/verify-email/${verifyId}/`)
  })
})
