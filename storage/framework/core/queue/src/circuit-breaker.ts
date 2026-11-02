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

import { db, lockRow, sqliteWriteOptions, parseSqlDateTime } from '@stacksjs/database/runtime'
import type { QueueStateConnection } from './state-row'
import { seedStateRow } from './state-row'
import { isMissingTableError } from './missing-table'

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
    '[queue/circuit-breaker] queue_circuit_state table missing - circuit breaker disabled. '
    + 'Run migrations to enable.',
  )
}


interface CircuitRow {
  queue_name: string
  success_count: number
  failure_count: number
  window_start: string
  paused_at: string | null
  resume_at: string | null
}

async function seedCircuitRow(tx: QueueStateConnection, queue: string, now: string): Promise<void> {
  await seedStateRow(tx, 'queue_circuit_state', ['queue_name'], {
    queue_name: queue, success_count: 0, failure_count: 0,
    window_start: now, paused_at: null, resume_at: null,
  })
}

/** Read and, when necessary, resume a queue while holding its state row. */
export async function isCircuitOpen(queue: string): Promise<boolean> {
  try {
    return await db.transaction(async (tx) => {
      const row = await lockRow(tx, 'queue_circuit_state', { queue_name: queue })
      if (!row?.paused_at) return false
      const resume = parseSqlDateTime(row.resume_at)?.getTime()
      if (resume !== undefined && Date.now() >= resume) {
        await tx.updateTable('queue_circuit_state').set({
          paused_at: null, resume_at: null, success_count: 0, failure_count: 0,
          window_start: new Date().toISOString().slice(0, 19).replace('T', ' '),
        }).where('queue_name', '=', queue).execute()
        return false
      }
      return true
    }, sqliteWriteOptions())
  }
  catch (error) {
    if (isMissingTableError(error)) { warnOnceAboutMissingTable(); return false }
    throw error
  }
}

/** Every observation and threshold decision owns the row through commit. */
async function recordObservation(queue: string, success: boolean, config: CircuitBreakerConfig): Promise<boolean> {
  const now = new Date()
  const nowStr = now.toISOString().slice(0, 19).replace('T', ' ')
  try {
    return await db.transaction(async (tx) => {
      await seedCircuitRow(tx, queue, nowStr)
      const row = await lockRow(tx, 'queue_circuit_state', { queue_name: queue }) as unknown as CircuitRow
      const start = parseSqlDateTime(row.window_start)?.getTime()
      const reset = start === undefined || now.getTime() - start >= (config.windowSeconds ?? 300) * 1000
      const successes = (reset ? 0 : Number(row.success_count)) + (success ? 1 : 0)
      const failures = (reset ? 0 : Number(row.failure_count)) + (success ? 0 : 1)
      const observed = successes + failures
      const trip = !success && !row.paused_at && observed >= (config.minObservations ?? 10)
        && failures / observed >= (config.failureRateThreshold ?? 0.5)
      await tx.updateTable('queue_circuit_state').set({
        success_count: successes,
        failure_count: failures,
        window_start: reset ? nowStr : row.window_start,
        ...(trip ? {
          paused_at: nowStr,
          resume_at: new Date(now.getTime() + (config.pauseSeconds ?? 300) * 1000).toISOString().slice(0, 19).replace('T', ' '),
        } : {}),
      }).where('queue_name', '=', queue).execute()
      return trip
    }, sqliteWriteOptions())
  }
  catch (error) {
    if (isMissingTableError(error)) { warnOnceAboutMissingTable(); return false }
    throw error
  }
}

export async function recordCircuitSuccess(queue: string, config: CircuitBreakerConfig = {}): Promise<void> {
  await recordObservation(queue, true, config)
}

export async function recordCircuitFailure(queue: string, config: CircuitBreakerConfig = {}): Promise<boolean> {
  return recordObservation(queue, false, config)
}

/** Manually pause without racing counter updates or automatic resume. */
export async function pauseQueue(queue: string, pauseSeconds = 300): Promise<void> {
  const now = new Date()
  const nowStr = now.toISOString().slice(0, 19).replace('T', ' ')
  try {
    await db.transaction(async (tx) => {
      await seedCircuitRow(tx, queue, nowStr)
      await lockRow(tx, 'queue_circuit_state', { queue_name: queue })
      await tx.updateTable('queue_circuit_state').set({
        paused_at: nowStr,
        resume_at: new Date(now.getTime() + pauseSeconds * 1000).toISOString().slice(0, 19).replace('T', ' '),
      }).where('queue_name', '=', queue).execute()
    }, sqliteWriteOptions())
  }
  catch (error) {
    if (isMissingTableError(error)) { warnOnceAboutMissingTable(); return }
    throw error
  }
}

export async function resumeQueue(queue: string): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      if (!await lockRow(tx, 'queue_circuit_state', { queue_name: queue })) return
      await tx.updateTable('queue_circuit_state').set({
        paused_at: null, resume_at: null, success_count: 0, failure_count: 0,
        window_start: new Date().toISOString().slice(0, 19).replace('T', ' '),
      }).where('queue_name', '=', queue).execute()
    }, sqliteWriteOptions())
  }
  catch (error) {
    if (isMissingTableError(error)) { warnOnceAboutMissingTable(); return }
    throw error
  }
}

/**
 * Snapshot the current circuit state for every tracked queue.
 * Used by `queue:status` to show paused queues alongside
 * pending/failed counts.
 */
export async function listCircuitState(): Promise<CircuitRow[]> {
  try {
    const rows = await db.selectFrom('queue_circuit_state').selectAll().execute()
    return (rows ?? []) as unknown as CircuitRow[]
  }
  catch (err) {
    if (isMissingTableError(err)) { warnOnceAboutMissingTable(); return [] }
    throw err
  }
}
