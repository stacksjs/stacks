/**
 * Distributed scheduler lock (stacksjs/stacks#1877 Cr-3, Cr-2).
 *
 * Background: `Schedule.acquireLock()` used a per-instance filesystem
 * lock. That works for `withoutOverlapping()` against a single
 * process, but `onOneServer()` claims to serialize across the entire
 * cluster — and silently no-ops the moment you scale past one
 * instance, because each instance has its own lock directory and
 * neither sees the other's state.
 *
 * Fix: pair the file lock with a DB-backed advisory lock when a SQL
 * connection is available. Mirrors the migration-lock module from
 * `@stacksjs/database` (stacksjs/stacks#1876 D-1):
 *
 *   - **PostgreSQL** — `pg_try_advisory_lock(key)`, session-scoped
 *     so a crashed holder's lock auto-releases on disconnect.
 *   - **MySQL** — `GET_LOCK('name', 0)`, same auto-release.
 *   - **SQLite** — falls back to the file lock (SQLite is
 *     single-writer anyway; multi-instance SQLite is its own bug).
 *
 * The file lock is still acquired alongside the DB lock so
 * intra-process overlap is also caught — DB lock costs a round-trip
 * each tick, file lock is essentially free for the common case where
 * the previous tick's task hasn't finished yet.
 *
 * Lock body shape: `{ acquiredAt: <ms wall>, monotonicStart: <ms perf>, holder: <pid> }`
 * stored as JSON inside the file. The monotonic-start is used to
 * compute lock age robustly against NTP clock shifts (Cr-2) — if
 * `Date.now() - acquiredAt` ever goes negative, we trust the
 * monotonic value or fail safe (treat the lock as held).
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

export type Dialect = 'sqlite' | 'mysql' | 'postgres'

export interface SchedulerLockHandle {
  release: () => Promise<void>
}

interface LockFileBody {
  acquiredAt: number
  monotonicStart: number
  holder: number
}

const KEY_PREFIX = 'stacks_scheduler'

/**
 * Compute the lock age robustly against NTP clock shifts (Cr-2).
 * Uses the wall-clock delta as the primary source but clamps to 0
 * when it goes negative (NTP corrected the clock backward) — failing
 * safe in the direction of "the holder still owns the lock."
 */
function safeLockAgeMs(body: LockFileBody): number {
  const delta = Date.now() - body.acquiredAt
  if (delta < 0) return 0
  return delta
}

/**
 * Try to acquire a distributed scheduler lock for `taskName`. The
 * lock is two-layered:
 *   1. **DB advisory lock** (PG/MySQL) — serializes across the cluster.
 *   2. **File lock** — serializes within the local process and
 *      provides a fallback when the DB connection isn't available.
 *
 * Returns a handle whose `release()` MUST be called in a finally so
 * the lock doesn't leak. Returns `null` (not an error) when the lock
 * can't be acquired — scheduler tasks SKIP rather than throw on
 * lock contention.
 *
 * @param taskName - human-readable name (logged + used in lock key)
 * @param expiryMs - file-lock staleness threshold; matches the
 *                   pre-fix overlapExpiresAfterMinutes semantics
 * @param dialect - SQL dialect from `getDialect()`; when 'sqlite' or
 *                  `null` the function uses file-lock-only mode
 * @param adminDb - bun-query-builder connection for advisory SQL;
 *                  `null` falls back to file-lock-only
 * @param lockDir - file-lock directory; default is `storage/framework/locks`
 */
export async function acquireSchedulerLock(
  taskName: string,
  expiryMs: number,
  dialect: Dialect | null,
  adminDb: { unsafe: (sql: string) => Promise<unknown> } | null,
  lockDir?: string,
): Promise<SchedulerLockHandle | null> {
  const resolvedDir = lockDir ?? join(process.cwd(), 'storage', 'framework', 'locks')
  const lockFile = join(resolvedDir, `${taskName}.lock`)

  if (!existsSync(resolvedDir)) {
    mkdirSync(resolvedDir, { recursive: true })
  }

  // Step 1: try the DB advisory lock if a SQL dialect + connection
  // are available. Note we skip the DB path for SQLite (single-writer
  // anyway) — multi-instance SQLite would have its own bigger
  // problems before we got here.
  let dbReleased = false
  let dbRelease: (() => Promise<void>) | null = null

  if (adminDb && (dialect === 'postgres' || dialect === 'mysql')) {
    const acquired = await tryDbLock(taskName, dialect, adminDb)
    if (!acquired) return null
    dbRelease = async () => {
      if (dbReleased) return
      dbReleased = true
      await releaseDbLock(taskName, dialect, adminDb).catch(() => {
        // Advisory locks auto-release on disconnect; if release
        // fails we're either disconnected (lock already gone) or
        // the connection is sick. Either way, not actionable here.
      })
    }
  }

  // Step 2: file lock. Two-tier so intra-process overlap is also
  // caught cheaply. If we got the DB lock above but fail the file
  // lock here, we release the DB lock and return null.
  const fileBody: LockFileBody = {
    acquiredAt: Date.now(),
    monotonicStart: Math.round(performance.now()),
    holder: process.pid,
  }

  try {
    writeFileSync(lockFile, JSON.stringify(fileBody), { flag: 'wx' })
  }
  catch {
    // File exists. Check whether it's stale and reclaim if so.
    let stale = false
    try {
      const raw = readFileSync(lockFile, 'utf8')
      const body = JSON.parse(raw) as LockFileBody
      const ageMs = safeLockAgeMs(body)
      if (ageMs >= expiryMs) stale = true
    }
    catch {
      // Lock file corrupt or unreadable — fall back to mtime check
      // for backwards-compat with files written by the pre-fix code.
      try {
        const stats = statSync(lockFile)
        const ageMs = Math.max(0, Date.now() - stats.mtimeMs)
        if (ageMs >= expiryMs) stale = true
      }
      catch {
        // File vanished between exists() and stat() — race against
        // another reclaimer. Treat as available; the next iteration
        // will either succeed or hit the same path.
        stale = true
      }
    }

    if (!stale) {
      if (dbRelease) await dbRelease()
      return null
    }

    // Reclaim the stale file lock.
    try {
      writeFileSync(lockFile, JSON.stringify(fileBody))
    }
    catch {
      if (dbRelease) await dbRelease()
      return null
    }
  }

  return {
    release: async () => {
      try {
        unlinkSync(lockFile)
      }
      catch {
        // Already gone — fine.
      }
      if (dbRelease) await dbRelease()
    },
  }
}

/**
 * Hash a task name to a stable 64-bit-ish integer pair for PG's
 * `pg_try_advisory_lock(key1, key2)`. Same approach as
 * @stacksjs/database/migration-lock.
 */
function pgKeys(taskName: string): { key1: number, key2: number } {
  const hash = createHash('sha256').update(`${KEY_PREFIX}:${taskName}`).digest()
  return {
    key1: hash.readInt32BE(0),
    key2: hash.readInt32BE(4),
  }
}

async function tryDbLock(
  taskName: string,
  dialect: 'postgres' | 'mysql',
  adminDb: { unsafe: (sql: string) => Promise<unknown> },
): Promise<boolean> {
  if (dialect === 'postgres') {
    const { key1, key2 } = pgKeys(taskName)
    const result = await adminDb.unsafe(`SELECT pg_try_advisory_lock(${key1}, ${key2}) AS acquired`)
    return extractFirstBool(result, 'acquired')
  }
  // MySQL: GET_LOCK with timeout=0 returns immediately.
  // Lock name capped at 64 chars by MySQL — hash if longer.
  const lockName = lockNameForMysql(taskName)
  const result = await adminDb.unsafe(`SELECT GET_LOCK('${lockName}', 0) AS acquired`)
  return extractFirstInt(result, 'acquired') === 1
}

async function releaseDbLock(
  taskName: string,
  dialect: 'postgres' | 'mysql',
  adminDb: { unsafe: (sql: string) => Promise<unknown> },
): Promise<void> {
  if (dialect === 'postgres') {
    const { key1, key2 } = pgKeys(taskName)
    await adminDb.unsafe(`SELECT pg_advisory_unlock(${key1}, ${key2})`)
    return
  }
  const lockName = lockNameForMysql(taskName)
  await adminDb.unsafe(`SELECT RELEASE_LOCK('${lockName}')`)
}

function lockNameForMysql(taskName: string): string {
  const candidate = `${KEY_PREFIX}_${taskName}`.replace(/[^A-Za-z0-9_]/g, '_')
  // MySQL caps GET_LOCK name at 64 chars; hash the tail when too long.
  if (candidate.length <= 64) return candidate
  const hashed = createHash('sha256').update(taskName).digest('hex').slice(0, 32)
  return `${KEY_PREFIX}_${hashed}`
}

function extractFirstBool(result: unknown, column: string): boolean {
  const row = pluckFirstRow(result)
  if (!row) return false
  const value = (row as Record<string, unknown>)[column]
  return value === true || value === 1 || value === '1' || value === 't'
}

function extractFirstInt(result: unknown, column: string): number | null {
  const row = pluckFirstRow(result)
  if (!row) return null
  const value = (row as Record<string, unknown>)[column]
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number.parseInt(value, 10)
  return null
}

function pluckFirstRow(result: unknown): unknown {
  if (!result) return null
  if (Array.isArray(result)) return result[0]
  if (typeof result === 'object' && 'rows' in result && Array.isArray((result as { rows: unknown[] }).rows))
    return (result as { rows: unknown[] }).rows[0]
  return null
}
