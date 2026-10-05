import { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } from '@stacksjs/database'
import { config } from '@stacksjs/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { claimDispatchKey } from '../src/idempotency'

/**
 * A duplicate dispatch key is a duplicate on every database.
 *
 * The check matched SQLite's "UNIQUE constraint" and MySQL's "Duplicate entry",
 * case-sensitively. Postgres says "duplicate key value violates unique
 * constraint", so `dispatchOnce()` threw on the second call there instead of
 * skipping. Postgres's wording is raised here by a trigger, on SQLite.
 */
let unlock: (() => void) | undefined

beforeAll(async () => {
  unlock = await acquireDbConfigLock()
  await ensureDatabaseConfigLoaded()
})

beforeEach(async () => {
  resetDatabaseConnection()
  initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: ':memory:' } }, queryLogging: { enabled: false } } })
  await db.unsafe(`CREATE TABLE job_idempotency (id INTEGER PRIMARY KEY AUTOINCREMENT, idempotency_key TEXT NOT NULL UNIQUE,
    job_name TEXT NOT NULL, queue TEXT NOT NULL DEFAULT 'default', dispatched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`).execute()
})

afterAll(() => {
  try {
    resetDatabaseConnection()
    initializeDbConfig(config)
  }
  finally {
    unlock?.()
  }
})

describe('claimDispatchKey', () => {
  it('reports a duplicate in SQLite\'s words', async () => {
    expect(await claimDispatchKey('k1', 'Job')).toBe('claimed')
    expect(await claimDispatchKey('k1', 'Job')).toBe('duplicate')
  })

  it('reports a duplicate in Postgres\'s words', async () => {
    await db.unsafe(`CREATE TRIGGER postgres_wording BEFORE INSERT ON job_idempotency
      WHEN EXISTS (SELECT 1 FROM job_idempotency WHERE idempotency_key = NEW.idempotency_key)
      BEGIN SELECT RAISE(ABORT, 'duplicate key value violates unique constraint "job_idempotency_idempotency_key_key"'); END`).execute()

    expect(await claimDispatchKey('k2', 'Job')).toBe('claimed')
    expect(await claimDispatchKey('k2', 'Job')).toBe('duplicate')
  })
})
