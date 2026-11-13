/**
 * A sign-up cannot put an advert in somebody else's inbox.
 *
 * Found on production services on 2026-11-13: accounts whose display NAME was
 * a gambling advert with a shortened link. Registration never proved the
 * address belonged to whoever registered it, and the welcome mail greeted the
 * account by name, so the application mailed that advert to a stranger from
 * its own domain.
 *
 * `RegisterAction` runs here against a real SQLite database, as in
 * `login-action-cookie.test.ts`, and the assertions are on what was stored,
 * what `user:registered` carried to its listeners, and what was refused.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { releaseOrm } from 'bun-query-builder'

const DB_PATH = join(tmpdir(), `stacks-registration-abuse-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'testing'

const { configureOrm } = await import('bun-query-builder')
const { config } = await import('@stacksjs/config')
const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const { ensureFrameworkAuthTables } = await import('./helpers/auth-schema')
const { listen, off } = await import('@stacksjs/events')
const { resetRateLimiters } = await import('@stacksjs/router')

const RegisterAction = (await import('../../../defaults/app/Actions/Auth/RegisterAction')).default

const PASSWORD = 'correct-horse-battery'
const ADVERT = 'KAZAN 70.000 TL bonus bit.ly/3xQ'

let releaseDbConfigLock: () => void
let registered: Array<Record<string, unknown>> = []
const onRegistered = (payload: unknown): void => {
  registered.push(payload as Record<string, unknown>)
}

/** Re-pin both connections to this file's database; see login-action-cookie.test.ts. */
async function forceConfig(): Promise<void> {
  process.env.DB_CONNECTION = 'sqlite'
  process.env.DB_DATABASE_PATH = DB_PATH
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

function request(fields: Record<string, unknown>): any {
  const all = { password: PASSWORD, ...fields }
  return {
    get: (key: string) => all[key as keyof typeof all],
    all: () => ({ ...all }),
  }
}

async function storedName(email: string): Promise<unknown> {
  const row = await db.selectFrom('users').select(['name']).where('email', '=', email).executeTakeFirst()
  return row ? row.name : undefined
}

/** The status a call to the action ends in, thrown or returned. */
async function statusOf(run: () => Promise<unknown>): Promise<{ status: number, message: string }> {
  try {
    const res = await run() as Response
    return { status: res.status, message: '' }
  }
  catch (error) {
    const failure = error as { status?: number, statusCode?: number, message?: string }
    return { status: Number(failure.status ?? failure.statusCode ?? 500), message: String(failure.message ?? '') }
  }
}

beforeAll(async () => {
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

  listen('user:registered' as never, onRegistered as never)
})

const originalRegistration = config.auth.registration

beforeEach(async () => {
  await forceConfig()
  // Each test spends its own budget.
  resetRateLimiters()
  config.auth.registration = originalRegistration
  registered = []
})

afterAll(() => {
  off('user:registered' as never, onRegistered as never)
  config.auth.registration = originalRegistration
  resetRateLimiters()
  releaseOrm()
  releaseDbConfigLock?.()
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(`${DB_PATH}${suffix}`))
      unlinkSync(`${DB_PATH}${suffix}`)
  }
})

describe('a name is not a place to put a link', () => {
  test('an advert for a name is refused, and no account is created', async () => {
    const outcome = await statusOf(() => RegisterAction.handle(request({ email: 'victim@example.com', name: ADVERT })))

    expect(outcome.status).toBe(422)
    expect(outcome.message).toContain('link')
    expect(await storedName('victim@example.com')).toBeUndefined()
    // No account, so nothing for a welcome mail to be sent about.
    expect(registered).toEqual([])
  })

  for (const name of ['<a href="//x">Ada</a>', 'Ada\r\nBcc: victim@example.com', 'visit example.com', 'a'.repeat(81)]) {
    test(`refuses ${JSON.stringify(name.slice(0, 30))}`, async () => {
      const email = `refused-${Math.random().toString(36).slice(2)}@example.com`
      const outcome = await statusOf(() => RegisterAction.handle(request({ email, name })))

      expect(outcome.status).toBe(422)
      expect(await storedName(email)).toBeUndefined()
    })
  }

  test('a real name is stored tidied, and listeners are told the first name only', async () => {
    const res = await RegisterAction.handle(request({ email: 'ada@example.com', name: '  Ada   Lovelace ' })) as Response
    const body = await res.json() as { user: { name: string } }

    expect(res.status).toBe(200)
    expect(await storedName('ada@example.com')).toBe('Ada Lovelace')
    expect(body.user.name).toBe('Ada Lovelace')

    expect(registered).toHaveLength(1)
    expect(registered[0]).toMatchObject({ email: 'ada@example.com', to: 'ada@example.com', name: 'Ada' })
  })
})

describe('bulk sign-up is slow', () => {
  test('one email address gets five attempts an hour', async () => {
    const attempt = () => statusOf(() => RegisterAction.handle(request({ email: 'Hammered@Example.com', name: ADVERT })))

    for (let i = 0; i < 5; i++)
      expect((await attempt()).status).toBe(422)
    expect((await attempt()).status).toBe(429)

    // Another address is not held up by it, and case does not buy a new budget.
    expect((await statusOf(() => RegisterAction.handle(request({ email: 'hammered@example.com', name: ADVERT })))).status).toBe(429)
    expect((await statusOf(() => RegisterAction.handle(request({ email: 'someone-else@example.com', name: 'Someone Else' })))).status).toBe(200)
  })

  test('one client address gets a configured number of attempts an hour', async () => {
    config.auth.registration = { ...originalRegistration, rateLimit: { perIp: 2 } }
    const attempt = (n: number) => statusOf(() => RegisterAction.handle(request({ email: `bulk-${n}@example.com`, name: 'Bulk Account' })))

    expect((await attempt(1)).status).toBe(200)
    expect((await attempt(2)).status).toBe(200)
    expect((await attempt(3)).status).toBe(429)
    expect(await storedName('bulk-3@example.com')).toBeUndefined()
  })

  test('a limit set to false is off', async () => {
    config.auth.registration = { ...originalRegistration, rateLimit: { perIp: false, perEmail: false } }

    for (let i = 0; i < 7; i++)
      expect((await statusOf(() => RegisterAction.handle(request({ email: 'unlimited@example.com', name: ADVERT })))).status).toBe(422)
  })
})
