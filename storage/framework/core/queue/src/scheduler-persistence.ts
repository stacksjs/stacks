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

import { log } from '@stacksjs/logging'

let ensured = false

/**
 * Create the marker table on first use. Returns false (and logs at debug) when
 * the database is unavailable, so callers can silently fall back to in-memory.
 */
async function ensureTable(): Promise<boolean> {
  if (ensured)
    return true
  try {
    const { db } = await import('@stacksjs/database')
    // `VARCHAR(255) PRIMARY KEY` is the framework's portable PK pattern across
    // sqlite / mysql / postgres; no dialect-specific bits are needed here.
    await (db as any).unsafe(
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
    const { db } = await import('@stacksjs/database')
    const row = await (db as any)
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

/**
 * Persist a job's `lastRun` (bounded to one row per job). Delete-then-insert is
 * a portable upsert that avoids the per-dialect UPDATE-affected-rows ambiguity
 * (MySQL reports 0 rows on an unchanged value); a single scheduler process owns
 * this table, so there is no concurrent-writer race. Best-effort.
 */
export async function persistLastRun(jobName: string, when: Date): Promise<void> {
  if (!await ensureTable())
    return
  try {
    const { db } = await import('@stacksjs/database')
    const iso = when.toISOString()
    await (db as any).deleteFrom('scheduled_job_runs').where('job_name', '=', jobName).execute()
    await (db as any).insertInto('scheduled_job_runs').values({ job_name: jobName, last_run_at: iso }).execute()
  }
  catch {
    // best-effort — a failed persist just means the in-memory guard is the only
    // protection until the next successful write
  }
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
    const { db } = await import('@stacksjs/database')
    const rows = await (db as any).unsafe(
      `SELECT 1 AS present FROM jobs WHERE payload LIKE ? ESCAPE '\\' LIMIT 1`,
      [overlapPayloadPattern(jobName)],
    ).execute()
    // Drivers disagree on the empty-result shape (`[]`, `{ rows: [] }`, or a
    // bare undefined), so ask only whether anything came back.
    const list = Array.isArray(rows) ? rows : (rows?.rows ?? [])
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
