/**
 * Dead-letter queue helpers (stacksjs/stacks#1885, Q-13 from #1872).
 *
 * Background: a job that fails its final retry lands in
 * `failed_jobs`. If an operator then runs `queue:retry <id>` and
 * the job fails AGAIN, the existing flow puts it back in
 * `failed_jobs` and the cycle can repeat indefinitely — wasting
 * worker capacity on a job that's permanently broken.
 *
 * Fix: a separate `dead_letter_jobs` table for jobs that have
 * already-failed-after-retry. Retries from the DLQ are explicit
 * (`queue:dlq:retry <id>`), not part of the default retry flow.
 *
 * Opt-in pattern matching the other dedup tables — warn-once-and-
 * degrade when the table isn't migrated yet.
 */

import { db } from '@stacksjs/database'

export type DeadLetterReason = 'repeat-failure' | 'poison-detected' | 'circuit-broken' | 'manual'

export interface DeadLetterRecord {
  id: number
  uuid: string
  connection: string
  queue: string
  payload: string
  exception: string
  reason: DeadLetterReason
  total_failures: number
  first_failed_at: string | null
  last_failed_at: string | null
  dead_lettered_at: string
}

let warnedAboutMissingTable = false

function warnOnceAboutMissingTable(): void {
  if (warnedAboutMissingTable) return
  warnedAboutMissingTable = true
  // eslint-disable-next-line no-console
  console.warn(
    '[queue/dlq] dead_letter_jobs table missing — DLQ disabled. '
    + 'Run migrations to enable poison-message isolation.',
  )
}

function isMissingTableError(err: unknown): boolean {
  const msg = (err as { message?: string } | null)?.message ?? ''
  return msg.includes('no such table') || msg.includes("doesn't exist")
}

/**
 * Move a job from `failed_jobs` into `dead_letter_jobs`. Called
 * by the retry path when a job re-fails, and by the poison/
 * circuit-breaker paths when they intercept a job pre-dispatch.
 *
 * Returns `true` on success, `false` when the DLQ table is missing
 * (caller falls back to today's behavior — leave the row in
 * `failed_jobs`).
 */
export async function moveToDeadLetter(
  failedJob: {
    uuid?: string
    connection?: string
    queue?: string
    payload?: string
    exception?: string
    failed_at?: string | null
  },
  reason: DeadLetterReason,
  totalFailures: number = 1,
): Promise<boolean> {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  try {
    await (db as any)
      .insertInto('dead_letter_jobs')
      .values({
        uuid: failedJob.uuid ?? crypto.randomUUID(),
        connection: failedJob.connection ?? 'database',
        queue: failedJob.queue ?? 'default',
        payload: failedJob.payload ?? '{}',
        exception: failedJob.exception ?? 'unknown',
        reason,
        total_failures: totalFailures,
        first_failed_at: failedJob.failed_at ?? now,
        last_failed_at: now,
        dead_lettered_at: now,
      })
      .execute()
    return true
  }
  catch (err) {
    if (isMissingTableError(err)) {
      warnOnceAboutMissingTable()
      return false
    }
    throw err
  }
}

/**
 * List dead-letter rows. Filters compose: `queue` narrows by
 * queue name, `since` filters by `dead_lettered_at` cutoff. Limit
 * defaults to 100 to keep CLI output manageable.
 */
export interface ListDeadLetterFilter {
  queue?: string
  reason?: DeadLetterReason
  sinceCutoffMs?: number
  limit?: number
}

export async function listDeadLetterJobs(filter: ListDeadLetterFilter = {}): Promise<DeadLetterRecord[]> {
  try {
    let q = (db as any).selectFrom('dead_letter_jobs').selectAll()
    if (filter.queue) q = q.where('queue', '=', filter.queue)
    if (filter.reason) q = q.where('reason', '=', filter.reason)
    if (filter.sinceCutoffMs) {
      const cutoff = new Date(filter.sinceCutoffMs).toISOString().slice(0, 19).replace('T', ' ')
      q = q.where('dead_lettered_at', '>=', cutoff)
    }
    if (filter.limit && filter.limit > 0) q = q.limit(filter.limit)
    const rows = await q.execute() as DeadLetterRecord[]
    return rows ?? []
  }
  catch (err) {
    if (isMissingTableError(err)) {
      warnOnceAboutMissingTable()
      return []
    }
    throw err
  }
}

/**
 * Pull a DLQ row back into the active `jobs` queue. Resets
 * `attempts` to 0 and `reserved_at` to null so the worker picks
 * it up on the next poll cycle. The original DLQ row is deleted
 * after the re-enqueue.
 *
 * Returns `true` when the job was found + re-enqueued, `false`
 * when the id didn't exist OR the DLQ table is missing.
 */
export async function retryDeadLetterJob(id: number): Promise<boolean> {
  try {
    const row = await (db as any)
      .selectFrom('dead_letter_jobs')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst() as DeadLetterRecord | undefined
    if (!row) return false

    const nowSec = Math.floor(Date.now() / 1000)
    await (db as any)
      .insertInto('jobs')
      .values({
        queue: row.queue,
        payload: row.payload,
        attempts: 0,
        reserved_at: null,
        available_at: nowSec,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      })
      .execute()

    await (db as any).deleteFrom('dead_letter_jobs').where('id', '=', id).execute()
    return true
  }
  catch (err) {
    if (isMissingTableError(err)) {
      warnOnceAboutMissingTable()
      return false
    }
    throw err
  }
}

/**
 * Delete DLQ rows older than `olderThanDays`. Useful for retention
 * cleanup — apps with high failure volume can prune rows after the
 * configured window. Default 30 days.
 *
 * Returns the number of rows deleted; 0 when the table is missing.
 */
export async function purgeDeadLetterJobs(olderThanDays: number = 30): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 19).replace('T', ' ')
    const result: any = await (db as any)
      .deleteFrom('dead_letter_jobs')
      .where('dead_lettered_at', '<', cutoff)
      .execute()
    return Number(result?.numDeletedRows ?? result?.[0]?.numDeletedRows ?? result?.affectedRows ?? 0)
  }
  catch (err) {
    if (isMissingTableError(err)) {
      warnOnceAboutMissingTable()
      return 0
    }
    throw err
  }
}
