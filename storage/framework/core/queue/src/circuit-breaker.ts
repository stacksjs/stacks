/**
 * Per-queue circuit breaker (stacksjs/stacks#1885, Q-13 from #1872).
 *
 * Background: a queue with a sustained high failure rate (e.g. a
 * downstream API outage taking every webhook-send job down) keeps
 * workers busy on doomed jobs. The poison detector catches single
 * `{jobName, payload}` pairs; the circuit breaker catches the
 * broader "this whole queue is unhealthy" pattern and pauses
 * processing for a cooldown period.
 *
 * Workers consult `isPaused(queue)` before claiming the next job.
 * Failure rate is tracked in a rolling window; when it breaches
 * the threshold, `paused_at` + `resume_at` get set and the worker
 * skips that queue until the cooldown elapses (or an operator
 * runs `queue:resume <queue>`).
 *
 * Opt-in via the `queue_circuit_state` table; degrades gracefully
 * when the table is missing.
 */

import { db } from '@stacksjs/database'

export interface CircuitBreakerConfig {
  /** Failure rate (0-1) over the window that trips the breaker. Default 0.5 (50%). */
  failureRateThreshold?: number
  /** Window length in seconds. Default 300 (5 minutes). */
  windowSeconds?: number
  /** Cooldown in seconds before the breaker auto-resumes. Default 300. */
  pauseSeconds?: number
  /** Minimum jobs observed in the window before the breaker can trip. Default 10. */
  minObservations?: number
}

let warnedAboutMissingTable = false

function warnOnceAboutMissingTable(): void {
  if (warnedAboutMissingTable) return
  warnedAboutMissingTable = true
  // eslint-disable-next-line no-console
  console.warn(
    '[queue/circuit-breaker] queue_circuit_state table missing — circuit breaker disabled. '
    + 'Run migrations to enable.',
  )
}

function isMissingTableError(err: unknown): boolean {
  const msg = (err as { message?: string } | null)?.message ?? ''
  return msg.includes('no such table') || msg.includes("doesn't exist")
}

interface CircuitRow {
  queue_name: string
  success_count: number
  failure_count: number
  window_start: string
  paused_at: string | null
  resume_at: string | null
}

async function getOrCreateRow(queue: string, nowStr: string): Promise<CircuitRow | null> {
  try {
    const existing = await (db as any)
      .selectFrom('queue_circuit_state')
      .where('queue_name', '=', queue)
      .selectAll()
      .executeTakeFirst() as CircuitRow | undefined
    if (existing) return existing
    await (db as any).insertInto('queue_circuit_state').values({
      queue_name: queue,
      success_count: 0,
      failure_count: 0,
      window_start: nowStr,
      paused_at: null,
      resume_at: null,
    }).execute()
    return {
      queue_name: queue,
      success_count: 0,
      failure_count: 0,
      window_start: nowStr,
      paused_at: null,
      resume_at: null,
    }
  }
  catch (err) {
    if (isMissingTableError(err)) {
      warnOnceAboutMissingTable()
      return null
    }
    // UNIQUE race (two workers seeded the same row) — re-fetch
    const msg = (err as { message?: string } | null)?.message ?? ''
    if (msg.includes('UNIQUE constraint') || msg.includes('Duplicate entry')) {
      return await (db as any)
        .selectFrom('queue_circuit_state')
        .where('queue_name', '=', queue)
        .selectAll()
        .executeTakeFirst() as CircuitRow | null
    }
    throw err
  }
}

/**
 * Is the queue currently paused? Returns `true` when `paused_at`
 * is set and `resume_at` hasn't passed yet. Also auto-clears the
 * paused state when the cooldown elapses so the next call sees
 * the queue as available again.
 */
export async function isCircuitOpen(queue: string): Promise<boolean> {
  try {
    const row = await (db as any)
      .selectFrom('queue_circuit_state')
      .where('queue_name', '=', queue)
      .select(['paused_at', 'resume_at'])
      .executeTakeFirst() as { paused_at: string | null, resume_at: string | null } | undefined
    if (!row || !row.paused_at) return false

    if (row.resume_at) {
      const resumeMs = Date.parse(row.resume_at.replace(' ', 'T') + 'Z')
      if (Number.isFinite(resumeMs) && Date.now() >= resumeMs) {
        // Cooldown elapsed — clear the pause state and treat as resumed.
        await (db as any).updateTable('queue_circuit_state')
          .set({ paused_at: null, resume_at: null, success_count: 0, failure_count: 0 })
          .where('queue_name', '=', queue)
          .execute()
        return false
      }
    }
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
 * Record a successful job. Maintained alongside failure_count so
 * the failure-rate calculation is meaningful. Window resets after
 * `windowSeconds` so an old failure burst doesn't permanently
 * skew the rate.
 */
export async function recordCircuitSuccess(queue: string, config: CircuitBreakerConfig = {}): Promise<void> {
  const windowSeconds = config.windowSeconds ?? 300
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const row = await getOrCreateRow(queue, nowStr)
  if (!row) return

  try {
    if (shouldResetWindow(row.window_start, windowSeconds)) {
      await (db as any).updateTable('queue_circuit_state')
        .set({ success_count: 1, failure_count: 0, window_start: nowStr })
        .where('queue_name', '=', queue).execute()
      return
    }
    await (db as any).updateTable('queue_circuit_state')
      .set({ success_count: row.success_count + 1 })
      .where('queue_name', '=', queue).execute()
  }
  catch (err) {
    if (isMissingTableError(err)) { warnOnceAboutMissingTable(); return }
    throw err
  }
}

/**
 * Record a failed job. After incrementing, evaluates whether the
 * failure rate has crossed the threshold and trips the breaker if
 * so. Returns `true` when this call triggered the trip.
 */
export async function recordCircuitFailure(queue: string, config: CircuitBreakerConfig = {}): Promise<boolean> {
  const threshold = config.failureRateThreshold ?? 0.5
  const windowSeconds = config.windowSeconds ?? 300
  const pauseSeconds = config.pauseSeconds ?? 300
  const minObservations = config.minObservations ?? 10
  const now = new Date()
  const nowStr = now.toISOString().slice(0, 19).replace('T', ' ')

  const row = await getOrCreateRow(queue, nowStr)
  if (!row) return false
  if (row.paused_at) return false // already tripped; just count

  try {
    let successCount = row.success_count
    let failureCount = row.failure_count
    if (shouldResetWindow(row.window_start, windowSeconds)) {
      successCount = 0
      failureCount = 0
    }
    failureCount += 1

    const observed = successCount + failureCount
    const rate = observed === 0 ? 0 : failureCount / observed
    const trip = observed >= minObservations && rate >= threshold

    if (trip) {
      const resumeAt = new Date(now.getTime() + pauseSeconds * 1000)
        .toISOString().slice(0, 19).replace('T', ' ')
      await (db as any).updateTable('queue_circuit_state')
        .set({
          success_count: successCount,
          failure_count: failureCount,
          window_start: nowStr,
          paused_at: nowStr,
          resume_at: resumeAt,
        })
        .where('queue_name', '=', queue)
        .execute()
      return true
    }

    await (db as any).updateTable('queue_circuit_state')
      .set({
        success_count: successCount,
        failure_count: failureCount,
        window_start: shouldResetWindow(row.window_start, windowSeconds) ? nowStr : row.window_start,
      })
      .where('queue_name', '=', queue)
      .execute()
    return false
  }
  catch (err) {
    if (isMissingTableError(err)) { warnOnceAboutMissingTable(); return false }
    throw err
  }
}

function shouldResetWindow(windowStart: string | null, windowSeconds: number): boolean {
  if (!windowStart) return true
  const startMs = Date.parse(windowStart.replace(' ', 'T') + 'Z')
  if (!Number.isFinite(startMs)) return true
  return (Date.now() - startMs) > windowSeconds * 1000
}

/**
 * Manually pause a queue for the given cooldown (default matches
 * the configured `pauseSeconds`). Useful when an operator knows
 * downstream is broken and wants to skip jobs immediately rather
 * than wait for the auto-trip.
 */
export async function pauseQueue(queue: string, pauseSeconds: number = 300): Promise<void> {
  const now = new Date()
  const nowStr = now.toISOString().slice(0, 19).replace('T', ' ')
  const resumeAt = new Date(now.getTime() + pauseSeconds * 1000)
    .toISOString().slice(0, 19).replace('T', ' ')
  await getOrCreateRow(queue, nowStr)
  try {
    await (db as any).updateTable('queue_circuit_state')
      .set({ paused_at: nowStr, resume_at: resumeAt })
      .where('queue_name', '=', queue)
      .execute()
  }
  catch (err) {
    if (isMissingTableError(err)) { warnOnceAboutMissingTable(); return }
    throw err
  }
}

/**
 * Lift the pause on a queue (manual resume). Workers resume
 * processing on the next poll cycle.
 */
export async function resumeQueue(queue: string): Promise<void> {
  try {
    await (db as any).updateTable('queue_circuit_state')
      .set({ paused_at: null, resume_at: null, success_count: 0, failure_count: 0 })
      .where('queue_name', '=', queue)
      .execute()
  }
  catch (err) {
    if (isMissingTableError(err)) { warnOnceAboutMissingTable(); return }
    throw err
  }
}

/**
 * Snapshot the current circuit state for every tracked queue.
 * Used by `queue:status` to show paused queues alongside
 * pending/failed counts.
 */
export async function listCircuitState(): Promise<CircuitRow[]> {
  try {
    const rows = await (db as any).selectFrom('queue_circuit_state').selectAll().execute()
    return (rows ?? []) as CircuitRow[]
  }
  catch (err) {
    if (isMissingTableError(err)) { warnOnceAboutMissingTable(); return [] }
    throw err
  }
}
