import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { acquireSchedulerLock } from '../src/scheduler-lock'

// Mirrors @stacksjs/database's migration-lock test layout — file-lock
// behavior is the easiest to verify deterministically. PG/MySQL paths
// are covered by mocked-db tests below.

describe('acquireSchedulerLock (file-only) — stacksjs/stacks#1877 Cr-3', () => {
  const testRoot = join(tmpdir(), `stacks-sched-lock-${Date.now()}`)
  const lockFile = join(testRoot, 'task.lock')

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

  test('writes JSON lock body with acquiredAt and holder pid', async () => {
    const handle = await acquireSchedulerLock('task', 60_000, null, null, testRoot)
    expect(handle).not.toBeNull()
    expect(existsSync(lockFile)).toBe(true)

    const body = JSON.parse(readFileSync(lockFile, 'utf8')) as { acquiredAt: number, holder: number, monotonicStart: number }
    expect(body.holder).toBe(process.pid)
    expect(typeof body.acquiredAt).toBe('number')
    expect(typeof body.monotonicStart).toBe('number')

    await handle!.release()
    expect(existsSync(lockFile)).toBe(false)
  })

  test('returns null on contended lock within the expiry window', async () => {
    const first = await acquireSchedulerLock('task', 60_000, null, null, testRoot)
    expect(first).not.toBeNull()

    const second = await acquireSchedulerLock('task', 60_000, null, null, testRoot)
    expect(second).toBeNull()

    await first!.release()
    const third = await acquireSchedulerLock('task', 60_000, null, null, testRoot)
    expect(third).not.toBeNull()
    await third!.release()
  })

  test('reclaims a stale lock past the expiry window', async () => {
    // Manually write a "stale" lock with acquiredAt back-dated 2 hours.
    writeFileSync(lockFile, JSON.stringify({
      acquiredAt: Date.now() - 2 * 60 * 60 * 1000,
      monotonicStart: 0,
      holder: 99999,
    }))
    // Also back-date mtime so the file-stat fallback path works too.
    const old = (Date.now() - 2 * 60 * 60 * 1000) / 1000
    utimesSync(lockFile, old, old)

    // Acquire with a 1-hour expiry — the 2-hour-old lock is stale.
    const handle = await acquireSchedulerLock('task', 60 * 60 * 1000, null, null, testRoot)
    expect(handle).not.toBeNull()
    const body = JSON.parse(readFileSync(lockFile, 'utf8')) as { holder: number }
    expect(body.holder).toBe(process.pid)
    await handle!.release()
  })

  test('clock-skew safety: negative ageMs treated as still held (Cr-2)', async () => {
    // Lock written with acquiredAt in the FUTURE (simulates NTP correcting
    // the clock backward between write and read). safeLockAgeMs clamps
    // to 0, so the lock should still appear held.
    writeFileSync(lockFile, JSON.stringify({
      acquiredAt: Date.now() + 60_000, // 1 minute in the future
      monotonicStart: 0,
      holder: 99999,
    }))

    const handle = await acquireSchedulerLock('task', 30_000, null, null, testRoot)
    expect(handle).toBeNull()

    // Cleanup — manually remove the lock file since we never owned it.
    rmSync(lockFile)
  })

  test('release() is idempotent', async () => {
    const handle = await acquireSchedulerLock('task', 60_000, null, null, testRoot)
    await handle!.release()
    await expect(handle!.release()).resolves.toBeUndefined()
  })

  test('SQLite dialect uses file-only path (no db requirement)', async () => {
    // SQLite is single-writer; multi-instance SQLite is its own bug,
    // so the lock degrades gracefully to file-only even when no adminDb
    // is passed.
    const handle = await acquireSchedulerLock('task', 60_000, 'sqlite', null, testRoot)
    expect(handle).not.toBeNull()
    await handle!.release()
  })
})

describe('acquireSchedulerLock (postgres mocked db)', () => {
  const testRoot = join(tmpdir(), `stacks-sched-lock-pg-${Date.now()}`)

  beforeEach(() => {
    mkdirSync(testRoot, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(testRoot, { recursive: true, force: true })
    }
    catch {
      // ignore
    }
  })

  function mockDb(behavior: (sql: string) => unknown): { unsafe: (sql: string) => Promise<unknown> } {
    return { unsafe: async (sql: string) => behavior(sql) }
  }

  test('acquires DB advisory lock + file lock together', async () => {
    let lockCalls = 0
    let unlockCalls = 0
    const db = mockDb((sql) => {
      if (sql.includes('pg_try_advisory_lock')) {
        lockCalls++
        return [{ acquired: true }]
      }
      if (sql.includes('pg_advisory_unlock')) {
        unlockCalls++
        return [{}]
      }
      return []
    })

    const handle = await acquireSchedulerLock('clustered-task', 60_000, 'postgres', db, testRoot)
    expect(handle).not.toBeNull()
    expect(lockCalls).toBe(1)

    await handle!.release()
    expect(unlockCalls).toBe(1)
  })

  test('returns null when DB lock is held by another session', async () => {
    const db = mockDb((sql) => {
      if (sql.includes('pg_try_advisory_lock'))
        return [{ acquired: false }]
      return []
    })

    const handle = await acquireSchedulerLock('clustered-task', 60_000, 'postgres', db, testRoot)
    expect(handle).toBeNull()
  })

  test('releases DB lock when file lock fails', async () => {
    // Pre-write a fresh file lock so our acquire fails at the file step.
    const lockFile = join(testRoot, 'clustered-task.lock')
    writeFileSync(lockFile, JSON.stringify({ acquiredAt: Date.now(), monotonicStart: 0, holder: 1 }))

    let unlockCalls = 0
    const db = mockDb((sql) => {
      if (sql.includes('pg_try_advisory_lock'))
        return [{ acquired: true }]
      if (sql.includes('pg_advisory_unlock')) {
        unlockCalls++
        return [{}]
      }
      return []
    })

    const handle = await acquireSchedulerLock('clustered-task', 60_000, 'postgres', db, testRoot)
    expect(handle).toBeNull()
    // The DB lock should have been released when the file lock failed
    // — leaving an orphan DB lock would block the next cluster-wide
    // acquisition forever (well, until session close).
    expect(unlockCalls).toBe(1)
  })
})

describe('acquireSchedulerLock (mysql mocked db)', () => {
  const testRoot = join(tmpdir(), `stacks-sched-lock-mysql-${Date.now()}`)

  beforeEach(() => {
    mkdirSync(testRoot, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(testRoot, { recursive: true, force: true })
    }
    catch {
      // ignore
    }
  })

  function mockDb(behavior: (sql: string) => unknown): { unsafe: (sql: string) => Promise<unknown> } {
    return { unsafe: async (sql: string) => behavior(sql) }
  }

  test('uses GET_LOCK / RELEASE_LOCK', async () => {
    let lockCalls = 0
    let unlockCalls = 0
    const db = mockDb((sql) => {
      if (sql.includes('GET_LOCK')) {
        lockCalls++
        return [{ acquired: 1 }]
      }
      if (sql.includes('RELEASE_LOCK')) {
        unlockCalls++
        return [{}]
      }
      return []
    })

    const handle = await acquireSchedulerLock('clustered-task', 60_000, 'mysql', db, testRoot)
    expect(handle).not.toBeNull()
    expect(lockCalls).toBe(1)

    await handle!.release()
    expect(unlockCalls).toBe(1)
  })
})
