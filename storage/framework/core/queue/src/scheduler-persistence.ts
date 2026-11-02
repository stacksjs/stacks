/**
 * Cross-restart persistence for the scheduler's per-job `lastRun` marker
 * (stacksjs/stacks#1984).
 *
 * `lastRun` lives only in memory and resets to null on every `startScheduler`,
 * so a deploy/restart that lands inside the same clock-minute a job fires would
 * re-dispatch a job that already ran that minute (a daily `0 3 * * *` backup
 * running twice, etc.). This persists ONE bounded row per job in a lazily-
 * created `scheduled_job_runs` table so `shouldRunNow`'s existing same-minute
 * guard survives a restart.
 *
 * Everything here is best-effort: any DB error degrades to the previous
 * in-memory-only behavior (no cross-restart dedup) rather than breaking the
 * scheduler. The table is created on first use, so no migration is required —
 * matching the opt-in / degrade-when-missing pattern the rest of the queue uses.
 */

import { sqliteWriteOptions } from '@stacksjs/database/runtime'
import type { UnsafeRowsResult } from '@stacksjs/database/runtime'
import { log } from '@stacksjs/logging'
import { buildScheduledJobRow, storeJob } from './utils'
import { seedStateRow } from './state-row'

let ensured = false

/**
 * Create the marker table on first use. Returns false (and logs at debug) when
 * the database is unavailable, so callers can silently fall back to in-memory.
 */
async function ensureTable(): Promise<boolean> {
  if (ensured)
    return true
  try {
    const { db } = await import('@stacksjs/database/runtime')
    // `VARCHAR(255) PRIMARY KEY` is the framework's portable PK pattern across
    // sqlite / mysql / postgres. The DDL needs no dialect-specific bits; the
    // placeholders in the queries below do, and used not to have them (#2846).
    await db.unsafe(
      'CREATE TABLE IF NOT EXISTS scheduled_job_runs ('
      + 'job_name VARCHAR(255) PRIMARY KEY, '
      + 'last_run_at VARCHAR(64) NOT NULL)',
    ).execute()
    ensured = true
    return true
  }
  catch (err) {
    log.debug(`[scheduler] run-marker persistence unavailable, using in-memory lastRun: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

/**
 * Load a job's persisted `lastRun`, or null when there's none / persistence is
 * unavailable. Used at startup so a restart doesn't re-fire a job that already
 * ran this minute.
 */
export async function loadPersistedLastRun(jobName: string): Promise<Date | null> {
  if (!await ensureTable())
    return null
  try {
    const { db } = await import('@stacksjs/database/runtime')
    const row = await db
      .selectFrom('scheduled_job_runs')
      .where('job_name', '=', jobName)
      .select(['last_run_at'])
      .executeTakeFirst() as { last_run_at?: string } | undefined
    if (!row?.last_run_at)
      return null
    const d = new Date(row.last_run_at)
    return Number.isNaN(d.getTime()) ? null : d
  }
  catch {
    return null
  }
}

/** Persist a marker without exposing a delete/insert gap to concurrent readers. */
export async function persistLastRun(jobName: string, when: Date): Promise<void> {
  if (!await ensureTable()) return
  try {
    const { db } = await import('@stacksjs/database/runtime')
    await db.transaction(async (tx) => {
      await seedStateRow(tx, 'scheduled_job_runs', ['job_name'], { job_name: jobName, last_run_at: when.toISOString() })
      await tx.updateTable('scheduled_job_runs').set({ last_run_at: when.toISOString() }).where('job_name', '=', jobName).execute()
    }, sqliteWriteOptions())
  }
  catch {
    // Standalone marker writes retain their best-effort contract.
  }
}

/** Commit the queue row and its once-per-minute marker together. */
export async function storeScheduledRun(jobName: string, when: Date, options: Parameters<typeof storeJob>[1]): Promise<boolean> {
  if (!await ensureTable()) {
    await storeJob(jobName, options)
    return true
  }
  const row = buildScheduledJobRow(jobName, options)
  const { db, lockRow } = await import('@stacksjs/database/runtime')
  return db.transaction(async (tx) => {
    await seedStateRow(tx, 'scheduled_job_runs', ['job_name'], { job_name: jobName, last_run_at: '' })
    const previous = await lockRow(tx, 'scheduled_job_runs', { job_name: jobName })
    if (previous && Math.floor(new Date(String(previous.last_run_at)).getTime() / 60_000) === Math.floor(when.getTime() / 60_000))
      return false
    await tx.insertInto('jobs').values({ ...row }).execute()
    await tx.updateTable('scheduled_job_runs').set({ last_run_at: when.toISOString() }).where('job_name', '=', jobName).execute()
    return true
  }, sqliteWriteOptions())
}

/**
 * Whether a previous dispatch of this scheduled job is still unfinished.
 *
 * This is what `preventOverlapping` / `withoutOverlapping` were supposed to
 * ask (stacksjs/stacks#1984). They consulted an in-memory `isRunning` flag that
 * the scheduler set immediately before `storeJob` and cleared immediately
 * after, so it described the few milliseconds of the ENQUEUE and was reliably
 * false again by the next tick — the guard never once fired, and a job that
 * takes longer than its interval still piled up.
 *
 * The queue row is the honest signal. It is deleted on success and on terminal
 * failure (after `failed_jobs` is written), and deliberately KEPT while a job
 * is waiting to retry — so "a row still exists" is precisely "the previous run
 * has not finished", which is the semantics being promised.
 *
 * Matched on the payload because `jobs` has no name column; `storeJob` writes
 * `{"jobName":"<name>",...}` as the first key, and the closing quote in the
 * pattern keeps `backup` from matching `backup-daily`. LIKE metacharacters in
 * the name are escaped, since `_` is legal in a job name and would otherwise
 * match any single character.
 *
 * Best-effort, like everything else here: an unavailable database returns
 * false, which degrades to the previous always-dispatch behaviour rather than
 * wedging the scheduler shut.
 */
/** The LIKE pattern {@link hasUnfinishedRun} matches a job's queue row with. */
export function overlapPayloadPattern(jobName: string): string {
  const escaped = jobName.replace(/[\\%_]/g, character => `\\${character}`)
  return `%"jobName":"${escaped}"%`
}

export async function hasUnfinishedRun(jobName: string): Promise<boolean> {
  try {
    const { db, getDatabaseDialect, sqlHelpers } = await import('@stacksjs/database/runtime')
    // The LIKE and its ESCAPE are portable; the placeholder is not. Postgres
    // has no `?` parameter, so this bound nothing there (stacksjs/stacks#2846).
    const { param } = sqlHelpers(getDatabaseDialect())
    const rows = await db.unsafe(
      `SELECT 1 AS present FROM jobs WHERE payload LIKE ${param(1)} ESCAPE '\\' LIMIT 1`,
      [overlapPayloadPattern(jobName)],
    ).execute()
    // Drivers disagree on the empty-result shape (`[]`, `{ rows: [] }`, or a
    // bare undefined), so ask only whether anything came back.
    // Drivers disagree on the shape of an empty result - `[]`, `{ rows: [] }`, or
    // a bare undefined - which `UnsafeReturn` does not express: it is declared as
    // the rows alone, so the `.rows` branch narrowed to `never` the moment the
    // `(db)` came off. The union says what the callers already handle.
    const raw = rows as UnsafeRowsResult
    const list = Array.isArray(raw) ? raw : (raw?.rows ?? [])
    return Array.isArray(list) && list.length > 0
  }
  catch (err) {
    log.debug(`[scheduler] overlap check unavailable, dispatching anyway: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

/** Test hook: reset the one-time table-ensured flag. */
export function __resetSchedulerPersistenceForTests(): void {
  ensured = false
}
