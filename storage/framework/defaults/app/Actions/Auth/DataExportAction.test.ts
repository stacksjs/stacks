import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

/**
 * GET /me/data-export, at the action seam, over the framework's own model
 * declarations and a real SQLite database holding two users.
 */

const DB_PATH = join(tmpdir(), `stacks-data-export-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'test'

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const { default: DataExportAction } = await import('./DataExportAction')

async function forceConfig(): Promise<void> {
  const release = await acquireDbConfigLock()
  try {
    await ensureDatabaseConfigLoaded()
    initializeDbConfig({
      app: { env: 'test' },
      database: { default: 'sqlite', connections: { sqlite: { database: DB_PATH, prefix: '' } } },
    })
  }
  finally {
    release()
  }
}

function requestAs(user: { id: number } | undefined): RequestInstance {
  return { user: async () => user } as unknown as RequestInstance
}

beforeAll(async () => {
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(`${DB_PATH}${suffix}`))
      unlinkSync(`${DB_PATH}${suffix}`)
  }
  await forceConfig()
  await db.unsafe(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, name TEXT, email TEXT, password TEXT, avatar TEXT, created_at TEXT, updated_at TEXT)`).execute()
  await db.unsafe(`CREATE TABLE gdpr_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, type TEXT NOT NULL, subject_id INTEGER, actor TEXT, status TEXT NOT NULL DEFAULT 'completed', summary TEXT, occurred_at TEXT NOT NULL, created_at TEXT, updated_at TEXT)`).execute()
  await db.unsafe(`INSERT INTO users (name, email, password) VALUES ('Ada Lovelace', 'ada@example.com', 'hash-ada'), ('Bob Byron', 'bob@example.com', 'hash-bob')`).execute()
})

afterAll(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      if (existsSync(`${DB_PATH}${suffix}`))
        unlinkSync(`${DB_PATH}${suffix}`)
    }
    catch {
      // best effort
    }
  }
})

describe('DataExportAction', () => {
  test('downloads the caller\'s own data, without the password hash, and records the request', async () => {
    await forceConfig()
    const res = await DataExportAction.handle(requestAs({ id: 2 })) as Response

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="personal-data-\d{4}-\d{2}-\d{2}\.json"$/)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')

    const body = await res.json() as { subject: { id: number }, data: Record<string, Array<Record<string, unknown>>> }
    expect(body.subject).toEqual({ id: 2 })
    expect(body.data.User).toEqual([expect.objectContaining({ id: 2, name: 'Bob Byron', email: 'bob@example.com' })])
    expect(JSON.stringify(body)).not.toContain('hash-bob')
    expect(JSON.stringify(body)).not.toContain('ada@example.com')

    const audit = await (db as any).selectFrom('gdpr_requests').selectAll().execute()
    expect(audit).toEqual([expect.objectContaining({ type: 'access', subject_id: 2, actor: 'api:user:2' })])
  })

  test('refuses an unauthenticated caller', async () => {
    const res = await DataExportAction.handle(requestAs(undefined)) as Response
    expect(res.status).toBe(401)
  })
})
