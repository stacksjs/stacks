/**
 * Distributed migration lock (stacksjs/stacks#1876 D-1).
 *
 * Background: `runDatabaseMigration()` reads the `migrations` table and
 * runs new entries — but two concurrent runners (two CI jobs, two app
 * instances on boot, two developer terminals) race against each other.
 * Both read the same state, both run the same migration, both insert
 * the same record. Result: constraint violations, half-applied
 * schemas, or — worst case — data corruption from a migration running
 * twice against a partially-applied schema.
 *
 * Fix: acquire a process-external mutex before reading the migrations
 * table. The mutex shape depends on the driver:
 *
 *   - **PostgreSQL** — session-scoped advisory lock via
 *     `pg_try_advisory_lock(key1, key2)`. Auto-releases on disconnect.
 *   - **MySQL** — named lock via `GET_LOCK('name', timeout)`. Auto-
 *     releases on session end.
 *   - **SQLite** — atomic file creation (`O_CREAT | O_EXCL`) on a
 *     lock file next to the DB. PID + start time written for forensic
 *     debugging. Stale-lock recovery is age-based (60s).
 *
 * All three support a short polling loop with backoff: if another
 * process has the lock, we wait up to ~30s before giving up with a
 * clear "another migration is in progress" error. That window is
 * long enough to absorb a slow CI sibling job but short enough that a
 * crashed lock-holder doesn't strand the next deploy forever.
 */

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { closeSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { userDatabasePath } from '@stacksjs/path'

export type Dialect = 'sqlite' | 'mysql' | 'postgres'

/**
 * Total time we'll wait for an existing lock-holder to release before
 * giving up. 30s is long enough to absorb a slow concurrent migration
 * (small schemas typically finish in seconds), short enough that a
 * crashed holder doesn't block deploys for minutes.
 */
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Initial backoff between retry attempts. Grows exponentially up to
 * 2000ms. Jitter is added each iteration to keep multiple waiters
 * from synchronizing on the retry boundary.
 */
const INITIAL_BACKOFF_MS = 100
const MAX_BACKOFF_MS = 2000

/**
 * SQLite lock files older than this are assumed stale (the process
 * that wrote them crashed without unlinking) and forcibly reclaimed.
 * Keep this comfortably larger than DEFAULT_TIMEOUT_MS so we never
 * reclaim a lock that's still being legitimately held.
 */
const STALE_LOCK_MS = 60_000

/**
 * Stable, dialect-agnostic name. Lives once in code so the lock
 * acquired by a PG migration matches the lock the next PG migration
 * tries to acquire — strings have to be byte-identical for MySQL's
 * `GET_LOCK`, and the int hash for PG must be derived from the same
 * seed.
 */
const LOCK_NAME = 'stacks_migrations'

/**
 * Returned by `acquireMigrationLock()`. Callers MUST invoke `release`
 * in a finally block; the lock is process-external (file, advisory,
 * or named) so leaking it strands future migration runs.
 */
export interface MigrationLockHandle {
  release: () => Promise<void>
}

/**
 * Acquire the distributed migration lock for the given dialect.
 * Returns a handle whose `release()` method MUST be called in a
 * `finally` to free the lock — even on error paths.
 *
 * @param dialect - which database driver is being migrated against
 * @param adminDb - the bun-query-builder connection to issue lock SQL
 *                  through (PG / MySQL). Ignored for SQLite.
 * @param opts.timeoutMs - max time to wait for an existing holder
 * @param opts.sqliteLockPath - override the file path SQLite uses
 *
 * Throws an error if the lock can't be acquired within `timeoutMs`.
 */
export async function acquireMigrationLock(
  dialect: Dialect,
  adminDb: { unsafe: (sql: string) => Promise<unknown> } | null,
  opts: { timeoutMs?: number, sqliteLockPath?: string } = {},
): Promise<MigrationLockHandle> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  // Check dialect FIRST so an unsupported value surfaces a clear
  // "unknown dialect" message rather than the misleading "requires a
  // database connection" path.
  if (dialect !== 'sqlite' && dialect !== 'postgres' && dialect !== 'mysql')
    throw new Error(`[migration-lock] unknown dialect: ${String(dialect)}`)

  if (dialect === 'sqlite')
    return acquireSqliteLock(opts.sqliteLockPath, timeoutMs)

  if (!adminDb)
    throw new Error(`[migration-lock] ${dialect} requires a database connection to acquire the lock`)

  if (dialect === 'postgres')
    return acquirePostgresLock(adminDb, timeoutMs)

  return acquireMySqlLock(adminDb, timeoutMs)
}

/**
 * Hash the lock name to a stable 64-bit-ish integer pair for PG's
 * `pg_try_advisory_lock(key1, key2)` two-argument form. Two 32-bit
 * ints give us 2^64 of namespace, dwarfing the chance of accidental
 * collision with any other library that uses advisory locks.
 */
function lockKeysForPostgres(): { key1: number, key2: number } {
  const hash = createHash('sha256').update(LOCK_NAME).digest()
  const key1 = hash.readInt32BE(0)
  const key2 = hash.readInt32BE(4)
  return { key1, key2 }
}

async function acquirePostgresLock(
  adminDb: { unsafe: (sql: string) => Promise<unknown> },
  timeoutMs: number,
): Promise<MigrationLockHandle> {
  const { key1, key2 } = lockKeysForPostgres()
  const start = Date.now()
  let backoff = INITIAL_BACKOFF_MS

  while (true) {
    const result = await adminDb.unsafe(`SELECT pg_try_advisory_lock(${key1}, ${key2}) AS acquired`)
    const acquired = extractFirstBool(result, 'acquired')

    if (acquired) {
      return {
        release: async () => {
          try {
            await adminDb.unsafe(`SELECT pg_advisory_unlock(${key1}, ${key2})`)
          }
          catch {
            // Best effort. If the connection died we've already lost the
            // lock anyway (advisory locks auto-release on disconnect).
          }
        },
      }
    }

    if (Date.now() - start >= timeoutMs)
      throw new Error('[migration-lock] another migration is in progress — could not acquire postgres advisory lock within timeout')

    await sleepWithJitter(backoff)
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
  }
}

async function acquireMySqlLock(
  adminDb: { unsafe: (sql: string) => Promise<unknown> },
  timeoutMs: number,
): Promise<MigrationLockHandle> {
  const start = Date.now()
  let backoff = INITIAL_BACKOFF_MS

  while (true) {
    // MySQL's GET_LOCK returns 1 on success, 0 on timeout, NULL on
    // error. Pass timeout=0 so each attempt returns immediately and
    // our outer loop owns the backoff schedule.
    const result = await adminDb.unsafe(`SELECT GET_LOCK('${LOCK_NAME}', 0) AS acquired`)
    const acquired = extractFirstInt(result, 'acquired') === 1

    if (acquired) {
      return {
        release: async () => {
          try {
            await adminDb.unsafe(`SELECT RELEASE_LOCK('${LOCK_NAME}')`)
          }
          catch {
            // Same best-effort rationale as PG.
          }
        },
      }
    }

    if (Date.now() - start >= timeoutMs)
      throw new Error('[migration-lock] another migration is in progress — could not acquire MySQL named lock within timeout')

    await sleepWithJitter(backoff)
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
  }
}

function defaultSqliteLockPath(): string {
  // Project-aware: resolves `<project>/database/.migration.lock`
  // regardless of cwd. The previous `join(process.cwd(), 'database', ...)`
  // ENOENT'd when migrations ran from a package directory (e.g.
  // `bun test` inside storage/framework/core/*), aborting the run.
  return userDatabasePath('.migration.lock')
}

async function acquireSqliteLock(
  lockPath: string | undefined,
  timeoutMs: number,
): Promise<MigrationLockHandle> {
  const path = lockPath ?? defaultSqliteLockPath()
  const start = Date.now()
  let backoff = INITIAL_BACKOFF_MS

  while (true) {
    if (tryCreateLockFile(path)) {
      let released = false
      return {
        release: async () => {
          if (released) return
          released = true
          try {
            unlinkSync(path)
          }
          catch {
            // Lock file already gone — likely we crashed and a peer
            // reclaimed it. Nothing more to do.
          }
        },
      }
    }

    // Lock file exists. If it's stale (older than STALE_LOCK_MS), the
    // holder probably crashed without unlinking. Reclaim and retry.
    reclaimIfStale(path)

    if (Date.now() - start >= timeoutMs)
      throw new Error(`[migration-lock] another migration is in progress — lock file ${path} held within timeout`)

    await sleepWithJitter(backoff)
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
  }
}

/**
 * Try to create the lock file atomically via `O_CREAT | O_EXCL`. POSIX
 * guarantees this either creates the file or fails with EEXIST — no
 * TOCTOU window between "check if exists" and "create". The file body
 * captures the holder's PID and start time for forensic debugging
 * when a deploy gets stuck and someone has to look at what's holding it.
 */
function tryCreateLockFile(path: string): boolean {
  try {
    const fd = openSync(path, 'wx')
    try {
      const payload = JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })
      writeFileSync(fd, Buffer.from(payload, 'utf8'))
    }
    finally {
      closeSync(fd)
    }
    return true
  }
  catch (e) {
    if ((e as { code?: string }).code === 'EEXIST') return false
    // Anything other than "already exists" is a real problem — surface it.
    throw e
  }
}

function reclaimIfStale(path: string): void {
  try {
    const st = statSync(path)
    const age = Date.now() - st.mtimeMs
    if (age > STALE_LOCK_MS) {
      try {
        unlinkSync(path)
      }
      catch {
        // Lost the race to another reclaimer — fine, they'll be the
        // ones to acquire next iteration.
      }
    }
  }
  catch {
    // File was deleted between our open-attempt and the stat — fine,
    // next loop iteration will see it gone.
  }
}

/**
 * Sleep with up to 25% jitter. Jitter keeps multiple waiters from
 * synchronizing on the same backoff schedule (which would amplify
 * contention).
 */
function sleepWithJitter(ms: number): Promise<void> {
  const jittered = ms * (1 + Math.random() * 0.25)
  return new Promise(resolve => setTimeout(resolve, jittered))
}

/**
 * bun-query-builder's `unsafe()` returns different shapes depending
 * on driver (array of rows for one driver, `{ rows: [...] }` for
 * another). Walk both shapes to pluck the first column value out.
 */
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
