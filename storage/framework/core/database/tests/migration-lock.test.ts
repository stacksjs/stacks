import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { acquireMigrationLock } from '../src/migration-lock'

// SQLite lock tests are the easiest to verify deterministically — no
// external DB needed, no transient connection state. PG/MySQL paths
// are covered by integration tests against real databases (see
// integration.test.ts); the unit tests here pin the file-based lock
// contract: atomic creation, stale-recovery, and timeout behavior.

describe('acquireMigrationLock (sqlite) — stacksjs/stacks#1876 D-1', () => {
  const testRoot = join(tmpdir(), `stacks-migration-lock-${Date.now()}`)
  const lockPath = join(testRoot, '.migration.lock')

  beforeEach(() => {
    mkdirSync(testRoot, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(testRoot, { recursive: true, force: true })
    }
    catch {
      // ignore cleanup errors
    }
  })

  test('creates the lock file on first acquisition', async () => {
    const handle = await acquireMigrationLock('sqlite', null, { sqliteLockPath: lockPath })
    expect(existsSync(lockPath)).toBe(true)

    const body = JSON.parse(readFileSync(lockPath, 'utf8')) as { pid: number, startedAt: string }
    expect(body.pid).toBe(process.pid)
    expect(typeof body.startedAt).toBe('string')

    await handle.release()
    expect(existsSync(lockPath)).toBe(false)
  })

  test('release() is idempotent', async () => {
    const handle = await acquireMigrationLock('sqlite', null, { sqliteLockPath: lockPath })
    await handle.release()
    await expect(handle.release()).resolves.toBeUndefined()
  })

  test('blocks a concurrent acquisition until the holder releases', async () => {
    const first = await acquireMigrationLock('sqlite', null, { sqliteLockPath: lockPath })

    // Concurrent acquisition with a tight timeout — should fail because
    // the first lock is still held.
    await expect(
      acquireMigrationLock('sqlite', null, { sqliteLockPath: lockPath, timeoutMs: 500 }),
    ).rejects.toThrow(/another migration is in progress/i)

    await first.release()

    // After release, a new acquisition succeeds.
    const second = await acquireMigrationLock('sqlite', null, { sqliteLockPath: lockPath, timeoutMs: 500 })
    expect(existsSync(lockPath)).toBe(true)
    await second.release()
  })

  test('reclaims a stale lock file (older than 60s)', async () => {
    // Write a "stale" lock file manually and back-date it.
    writeFileSync(lockPath, JSON.stringify({ pid: 99999, startedAt: '2020-01-01T00:00:00Z' }))
    const oldTime = (Date.now() - 120_000) / 1000 // 2 minutes ago
    utimesSync(lockPath, oldTime, oldTime)
    expect(statSync(lockPath)).toBeDefined()

    // Acquisition should reclaim the stale lock and succeed quickly.
    const handle = await acquireMigrationLock('sqlite', null, {
      sqliteLockPath: lockPath,
      timeoutMs: 5_000, // generous so a slow CI box doesn't flake
    })
    expect(existsSync(lockPath)).toBe(true)
    // PID in the new lock file should be the current process, not the stale 99999.
    const body = JSON.parse(readFileSync(lockPath, 'utf8')) as { pid: number }
    expect(body.pid).toBe(process.pid)

    await handle.release()
  })

  test('does NOT reclaim a fresh lock file', async () => {
    // Write a lock file with a fresh mtime (now).
    writeFileSync(lockPath, JSON.stringify({ pid: 99999, startedAt: new Date().toISOString() }))

    await expect(
      acquireMigrationLock('sqlite', null, { sqliteLockPath: lockPath, timeoutMs: 300 }),
    ).rejects.toThrow(/another migration is in progress/i)
  })
})

describe('acquireMigrationLock (unknown dialect)', () => {
  test('throws for unsupported dialect', async () => {
    // @ts-expect-error - testing runtime guard for unsupported dialect
    await expect(acquireMigrationLock('mongo', null)).rejects.toThrow(/unknown dialect/i)
  })

  test('throws if PG/MySQL is called without a db connection', async () => {
    await expect(acquireMigrationLock('postgres', null)).rejects.toThrow(/requires a database connection/i)
    await expect(acquireMigrationLock('mysql', null)).rejects.toThrow(/requires a database connection/i)
  })
})

describe('acquireMigrationLock (postgres) — mocked db', () => {
  function mockDb(behavior: (sql: string) => unknown): { unsafe: (sql: string) => Promise<unknown> } {
    return {
      unsafe: async (sql: string) => behavior(sql),
    }
  }

  test('returns immediately on first successful pg_try_advisory_lock', async () => {
    let releaseCalled = false
    const db = mockDb((sql) => {
      if (sql.includes('pg_try_advisory_lock'))
        return [{ acquired: true }]
      if (sql.includes('pg_advisory_unlock')) {
        releaseCalled = true
        return [{}]
      }
      return []
    })

    const handle = await acquireMigrationLock('postgres', db)
    await handle.release()
    expect(releaseCalled).toBe(true)
  })

  test('retries with backoff when pg_try_advisory_lock returns false', async () => {
    let attempts = 0
    const db = mockDb((sql) => {
      if (sql.includes('pg_try_advisory_lock')) {
        attempts++
        // Succeed on the 3rd attempt.
        return [{ acquired: attempts >= 3 }]
      }
      return []
    })

    const handle = await acquireMigrationLock('postgres', db, { timeoutMs: 5_000 })
    expect(attempts).toBeGreaterThanOrEqual(3)
    await handle.release()
  })

  test('throws after timeout if lock never released', async () => {
    const db = mockDb((sql) => {
      if (sql.includes('pg_try_advisory_lock'))
        return [{ acquired: false }]
      return []
    })

    await expect(
      acquireMigrationLock('postgres', db, { timeoutMs: 300 }),
    ).rejects.toThrow(/postgres advisory lock/i)
  })
})

describe('acquireMigrationLock (mysql) — mocked db', () => {
  function mockDb(behavior: (sql: string) => unknown): { unsafe: (sql: string) => Promise<unknown> } {
    return {
      unsafe: async (sql: string) => behavior(sql),
    }
  }

  test('returns immediately on first successful GET_LOCK', async () => {
    let releaseCalled = false
    const db = mockDb((sql) => {
      if (sql.includes('GET_LOCK'))
        return [{ acquired: 1 }]
      if (sql.includes('RELEASE_LOCK')) {
        releaseCalled = true
        return [{}]
      }
      return []
    })

    const handle = await acquireMigrationLock('mysql', db)
    await handle.release()
    expect(releaseCalled).toBe(true)
  })

  test('throws after timeout if GET_LOCK never returns 1', async () => {
    const db = mockDb((sql) => {
      if (sql.includes('GET_LOCK'))
        return [{ acquired: 0 }]
      return []
    })

    await expect(
      acquireMigrationLock('mysql', db, { timeoutMs: 300 }),
    ).rejects.toThrow(/MySQL named lock/i)
  })

  test('accepts string "1" as success (MySQL drivers vary)', async () => {
    const db = mockDb((sql) => {
      if (sql.includes('GET_LOCK'))
        return [{ acquired: '1' }]
      return []
    })

    const handle = await acquireMigrationLock('mysql', db)
    await handle.release()
  })
})
