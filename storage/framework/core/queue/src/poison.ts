/**
 * Poison-message detection (stacksjs/stacks#1885, Q-13 from #1872).
 *
 * Background: a job class with a permanent defect (bad payload
 * shape, third-party API returning 410 Gone, etc.) cycles through
 * the queue → retry → fail → retry forever, eating worker capacity
 * indefinitely. The DLQ catches individual jobs after their second
 * failure; this module catches the broader CLASS of failure by
 * tracking `{jobName + payload-hash}` failure counts over a rolling
 * window.
 *
 * When a `{jobName, payload-hash}` exceeds the threshold (default
 * 5 failures in 60 minutes), the entry is marked `quarantined_at`.
 * Future dispatches of that exact job + payload combo land
 * directly in the DLQ instead of the queue — operator runs
 * `queue:unquarantine <jobName>` to lift the block once the
 * underlying issue is fixed.
 *
 * Opt-in via the `job_quarantine` table; degrades when the table
 * is missing (no poison detection, no quarantine).
 */

import { createHash } from 'node:crypto'
import { db } from '@stacksjs/database'

export interface PoisonConfig {
  /** Failures-in-window threshold. Default 5. */
  maxFailures?: number
  /** Window length in minutes. Default 60. */
  windowMinutes?: number
}

let warnedAboutMissingTable = false

function warnOnceAboutMissingTable(): void {
  if (warnedAboutMissingTable) return
  warnedAboutMissingTable = true
  // eslint-disable-next-line no-console
  console.warn(
    '[queue/poison] job_quarantine table missing — poison detection disabled. '
    + 'Run migrations to enable.',
  )
}

function isMissingTableError(err: unknown): boolean {
  const msg = (err as { message?: string } | null)?.message ?? ''
  return msg.includes('no such table') || msg.includes("doesn't exist")
}

/**
 * Compute the dedup key for a job+payload combination. Stable
 * sha256 truncated to 32 hex chars — short enough to fit in
 * indexed columns, wide enough to avoid collisions in practice.
 */
export function hashPayload(payload: unknown): string {
  let serialized: string
  try { serialized = typeof payload === 'string' ? payload : JSON.stringify(payload ?? null) }
  catch { serialized = String(payload) }
  return createHash('sha256').update(serialized).digest('hex').slice(0, 32)
}

/**
 * Record a failure against `(jobName, payload-hash)`. If this push
 * makes the count exceed the threshold within the window, the row
 * is marked `quarantined_at` and the function returns `true`.
 *
 * Called from the worker's failure path AFTER the job lands in
 * `failed_jobs`. Failures outside the window reset the count.
 */
export async function recordFailureForPoison(
  jobName: string,
  payload: unknown,
  config: PoisonConfig = {},
): Promise<boolean> {
  const maxFailures = config.maxFailures ?? 5
  const windowMinutes = config.windowMinutes ?? 60
  const payloadHash = hashPayload(payload)
  const now = new Date()
  const nowStr = now.toISOString().slice(0, 19).replace('T', ' ')

  try {
    const existing = await (db as any)
      .selectFrom('job_quarantine')
      .where('job_name', '=', jobName)
      .where('payload_hash', '=', payloadHash)
      .selectAll()
      .executeTakeFirst() as { id: number, failure_count: number, window_start: string, quarantined_at: string | null } | undefined

    if (!existing) {
      await (db as any).insertInto('job_quarantine').values({
        job_name: jobName,
        payload_hash: payloadHash,
        failure_count: 1,
        window_start: nowStr,
        quarantined_at: null,
      }).execute()
      return false
    }

    if (existing.quarantined_at) return true // already quarantined

    // If the existing window is older than the configured window,
    // reset rather than continue accumulating (the failure burst
    // ended; this is a fresh occurrence).
    const windowStartMs = Date.parse(existing.window_start.replace(' ', 'T') + 'Z')
    const ageMs = now.getTime() - windowStartMs
    const windowMs = windowMinutes * 60 * 1000
    if (Number.isFinite(windowStartMs) && ageMs > windowMs) {
      await (db as any).updateTable('job_quarantine')
        .set({ failure_count: 1, window_start: nowStr })
        .where('id', '=', existing.id)
        .execute()
      return false
    }

    const newCount = existing.failure_count + 1
    if (newCount >= maxFailures) {
      await (db as any).updateTable('job_quarantine')
        .set({ failure_count: newCount, quarantined_at: nowStr })
        .where('id', '=', existing.id)
        .execute()
      return true
    }

    await (db as any).updateTable('job_quarantine')
      .set({ failure_count: newCount })
      .where('id', '=', existing.id)
      .execute()
    return false
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
 * Is `(jobName, payload)` currently quarantined? Called from the
 * dispatch path — true means "skip the queue, route directly to
 * the DLQ".
 */
export async function isQuarantined(jobName: string, payload: unknown): Promise<boolean> {
  const payloadHash = hashPayload(payload)
  try {
    const row = await (db as any)
      .selectFrom('job_quarantine')
      .where('job_name', '=', jobName)
      .where('payload_hash', '=', payloadHash)
      .where('quarantined_at', 'is not', null)
      .select(['id'])
      .executeTakeFirst()
    return Boolean(row)
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
 * Manually quarantine a job class. Useful when an operator knows
 * a particular flow is broken (e.g. third-party API outage) and
 * wants to stop the queue from churning on it before the failure
 * threshold trips.
 *
 * If `payload` is omitted, every payload-hash for the job name is
 * matched (uses wildcard `payload_hash = '*'`). For class-wide
 * quarantine without per-payload granularity.
 */
export async function quarantineJob(jobName: string, payload?: unknown): Promise<void> {
  const payloadHash = payload === undefined ? '*' : hashPayload(payload)
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')
  try {
    const existing = await (db as any)
      .selectFrom('job_quarantine')
      .where('job_name', '=', jobName)
      .where('payload_hash', '=', payloadHash)
      .select(['id'])
      .executeTakeFirst() as { id: number } | undefined
    if (existing) {
      await (db as any).updateTable('job_quarantine')
        .set({ quarantined_at: nowStr })
        .where('id', '=', existing.id)
        .execute()
    }
    else {
      await (db as any).insertInto('job_quarantine').values({
        job_name: jobName,
        payload_hash: payloadHash,
        failure_count: 0,
        window_start: nowStr,
        quarantined_at: nowStr,
      }).execute()
    }
  }
  catch (err) {
    if (isMissingTableError(err)) {
      warnOnceAboutMissingTable()
      return
    }
    throw err
  }
}

/**
 * Lift the quarantine for a job class. Deletes every
 * `job_quarantine` row matching `jobName` (across all payload
 * hashes) so future dispatches go to the queue normally.
 */
export async function unquarantineJob(jobName: string): Promise<void> {
  try {
    await (db as any)
      .deleteFrom('job_quarantine')
      .where('job_name', '=', jobName)
      .execute()
  }
  catch (err) {
    if (isMissingTableError(err)) {
      warnOnceAboutMissingTable()
      return
    }
    throw err
  }
}

/**
 * Read the set of currently-quarantined job names + payload hashes
 * for the `queue:quarantine` CLI list view.
 */
export async function listQuarantined(): Promise<Array<{
  id: number
  job_name: string
  payload_hash: string
  failure_count: number
  quarantined_at: string | null
}>> {
  try {
    const rows = await (db as any)
      .selectFrom('job_quarantine')
      .where('quarantined_at', 'is not', null)
      .selectAll()
      .execute()
    return (rows ?? []) as Array<{
      id: number
      job_name: string
      payload_hash: string
      failure_count: number
      quarantined_at: string | null
    }>
  }
  catch (err) {
    if (isMissingTableError(err)) {
      warnOnceAboutMissingTable()
      return []
    }
    throw err
  }
}
