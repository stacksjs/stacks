/**
 * Magic-link (passwordless) sign-in tests.
 *
 * Same harness shape as password-reset-revocation.test.ts: env pinned to a
 * throwaway SQLite file before any framework module loads, email stubbed so
 * sends settle instantly, config re-forced before every test because the
 * directory shares one process.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const DB_PATH = join(tmpdir(), `stacks-magic-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'testing'

const sentMails: { to: string, text?: string, html?: string }[] = []
const realEmail = { ...await import('@stacksjs/email') }
mock.module('@stacksjs/email', () => ({
  ...realEmail,
  template: async () => ({ html: '', text: '' }),
  mail: {
    send: async (message: { to: string, text?: string, html?: string }) => { sentMails.push(message) },
    sendOrFail: async (message: { to: string, text?: string, html?: string }) => { sentMails.push(message) },
  },
}))

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const { consumeMagicLink, pruneMagicLinkTokens, sendMagicLink } = await import('../src/magic-link')
const { RateLimiter } = await import('../src/rate-limiter')


async function forceConfig(): Promise<void> {
  /*
   * Held for the MUTATION only. Acquiring at module scope and releasing from
   * the `process.on('exit')` handler meant holding it for the whole of
   * `bun test`, since every file shares one process - so each later file
   * wanting the lock waited out the full 60s watchdog
   * (stacksjs/stacks#2413).
   */
  const releaseDbConfigLock = await acquireDbConfigLock()

  try {
    await ensureDatabaseConfigLoaded()
    initializeDbConfig({
      app: { env: 'testing' },
      database: {
        default: 'sqlite',
        connections: { sqlite: { database: DB_PATH, prefix: '' } },
      },
    })
  }
  finally {
    releaseDbConfigLock()
  }
}

beforeAll(async () => {
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(`${DB_PATH}${suffix}`))
      unlinkSync(`${DB_PATH}${suffix}`)
  }
  await forceConfig()

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255),
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255),
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    )
  `).execute()

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
})

beforeEach(async () => {
  await forceConfig()
  await db.unsafe('DELETE FROM magic_link_tokens').execute()
  await db.unsafe('DELETE FROM users').execute()
  sentMails.length = 0
  RateLimiter.useMemoryStore()
})

afterAll(() => {
  /*
   * Put `@stacksjs/email` back. `mock.module` is process-global and never rolled
   * back, so leaving the stub installed handed every later file a `mail` with
   * two methods and a `template` that returns empty strings - which is why
   * `core/email` lost nine tests in a full-tree run while passing on its own
   * (stacksjs/stacks#2413). The three sibling files that mock this module
   * already restore it; this one did not.
   */
  mock.module('@stacksjs/email', () => realEmail)

  for (const suffix of ['', '-wal', '-shm']) {
    try {
      if (existsSync(`${DB_PATH}${suffix}`))
        unlinkSync(`${DB_PATH}${suffix}`)
    }
    catch {
      // tmpdir file, best effort
    }
  }
})

async function seedUser(email: string): Promise<number> {
  await db.unsafe(`
    INSERT INTO users (name, email, password, created_at, updated_at)
    VALUES ('Parent', ?, NULL, datetime('now'), datetime('now'))
  `, [email]).execute()
  const rows = await db.unsafe('SELECT id FROM users WHERE email = ?', [email]).execute()
  return Number((rows as { id: number }[])[0]!.id)
}

function linkTokenFromMail(): string {
  const text = sentMails[sentMails.length - 1]?.text ?? ''
  const match = text.match(/\/auth\/magic\/([\w-]+)/)
  if (!match)
    throw new Error(`no magic link in mail text: ${text}`)
  return match[1]!
}

async function tokenRows(): Promise<{ email: string, token: string, consumed_at: string | null }[]> {
  return await db.unsafe('SELECT email, token, consumed_at FROM magic_link_tokens').execute() as never
}

describe('sendMagicLink', () => {
  test('unknown email is a silent no-op: no row, no mail', async () => {
    await sendMagicLink('nobody@example.com')
    expect(await tokenRows()).toHaveLength(0)
    expect(sentMails).toHaveLength(0)
  })

  test('known email stores sha256 at rest, never the raw token', async () => {
    await seedUser('parent@example.com')
    await sendMagicLink('parent@example.com')

    const rows = await tokenRows()
    expect(rows).toHaveLength(1)
    const raw = linkTokenFromMail()
    expect(rows[0]!.token).not.toBe(raw)
    expect(rows[0]!.token).toMatch(/^[0-9a-f]{64}$/)
  })

  test('a second send invalidates the first link', async () => {
    await seedUser('parent@example.com')
    await sendMagicLink('parent@example.com')
    const firstRaw = linkTokenFromMail()
    await sendMagicLink('parent@example.com')

    expect(await tokenRows()).toHaveLength(1)
    const result = await consumeMagicLink(firstRaw)
    expect(result.ok).toBe(false)
  })

  test('createUser provisions a passwordless account', async () => {
    await sendMagicLink('new-family@example.com', { createUser: true })

    const users = await db.unsafe('SELECT email, password FROM users').execute() as { email: string, password: string | null }[]
    expect(users).toHaveLength(1)
    expect(users[0]!.email).toBe('new-family@example.com')
    expect(users[0]!.password).toBeNull()
    expect(await tokenRows()).toHaveLength(1)
  })
})

describe('consumeMagicLink', () => {
  test('a valid link consumes once and returns the user', async () => {
    const userId = await seedUser('parent@example.com')
    await sendMagicLink('parent@example.com', { redirectTo: '/portal' })
    const raw = linkTokenFromMail()

    const first = await consumeMagicLink(raw)
    expect(first).toEqual({ ok: true, userId, email: 'parent@example.com', redirectTo: '/portal' })

    const second = await consumeMagicLink(raw)
    expect(second).toEqual({ ok: false, reason: 'used' })
  })

  test('concurrent consumes have exactly one winner', async () => {
    await seedUser('parent@example.com')
    await sendMagicLink('parent@example.com')
    const raw = linkTokenFromMail()

    const results = await Promise.all(Array.from({ length: 5 }, () => consumeMagicLink(raw)))
    expect(results.filter(result => result.ok)).toHaveLength(1)
    expect(results.filter(result => !result.ok && result.reason === 'used')).toHaveLength(4)
  })

  test('an expired link says expired', async () => {
    await seedUser('parent@example.com')
    await sendMagicLink('parent@example.com', { ttlMinutes: -1 })
    const raw = linkTokenFromMail()

    expect(await consumeMagicLink(raw)).toEqual({ ok: false, reason: 'expired' })
  })

  test('garbage tokens are invalid, and absolute redirects are neutralized', async () => {
    expect(await consumeMagicLink('not-a-real-token')).toEqual({ ok: false, reason: 'invalid' })

    await seedUser('parent@example.com')
    await sendMagicLink('parent@example.com', { redirectTo: 'https://evil.example/phish' })
    const raw = linkTokenFromMail()
    const result = await consumeMagicLink(raw)
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.redirectTo).toBe('/')
  })
})

describe('pruneMagicLinkTokens', () => {
  test('drops long-expired rows', async () => {
    await seedUser('parent@example.com')
    await sendMagicLink('parent@example.com', { ttlMinutes: -60 * 24 * 30 })
    expect(await tokenRows()).toHaveLength(1)

    await pruneMagicLinkTokens(7)
    expect(await tokenRows()).toHaveLength(0)
  })
})
