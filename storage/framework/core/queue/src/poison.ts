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

import { hash } from 'node:crypto'
import { db, lockRow, sqliteWriteOptions, parseSqlDateTime } from '@stacksjs/database/runtime'
import { seedStateRow } from './state-row'
import { isMissingTableError } from './missing-table'

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
    '[queue/poison] job_quarantine table missing - poison detection disabled. '
    + 'Run migrations to enable.',
  )
}


/**
 * Compute the dedup key for a job+payload combination. Stable
 * sha256 truncated to 32 hex chars — short enough to fit in
 * indexed columns, wide enough to avoid collisions in practice.
 */
function serializePayload(payload: unknown): string {
  try { return typeof payload === 'string' ? payload : JSON.stringify(payload ?? null) }
  catch { return String(payload) }
}

/** Legacy hash API: retained so persisted v1 rows and callers keep their vectors. */
export function hashPayload(payload: unknown): string {
  return hash('sha256', serializePayload(payload), 'hex').slice(0, 32)
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map(key => [key, canonicalJson(record[key])]))
  }
  return value
}

function payloadKeys(payload: unknown): { current: string, legacy: string } {
  // Serialize once, including any toJSON/fallback behavior, then canonicalize
  // plain JSON rather than invoking user serializers a second time.
  const serialized = serializePayload(payload)
  const legacy = hash('sha256', serialized, 'hex').slice(0, 32)
  let value: unknown = serialized
  if (typeof payload !== 'string') {
    try { value = JSON.parse(serialized) }
    catch { /* Legacy non-JSON fallback remains a distinct representation. */ }
  }
  return { current: `v2:${hash('sha256', JSON.stringify([typeof payload, canonicalJson(value)]), 'hex').slice(0, 32)}`, legacy }
}

type QueueTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Lock the v2 row first everywhere, then absorb a matching legacy row once. */
async function payloadState(tx: QueueTransaction, jobName: string, keys: { current: string, legacy: string }, now: string, windowMs: number): Promise<Record<string, unknown>> {
  await seedStateRow(tx, 'job_quarantine', ['job_name', 'payload_hash'], {
    job_name: jobName, payload_hash: keys.current, failure_count: 0, window_start: now, quarantined_at: null,
  })
  const current = await lockRow(tx, 'job_quarantine', { job_name: jobName, payload_hash: keys.current })
  if (!current) throw new Error('Poison state disappeared while locked')
  if (keys.legacy === keys.current) return current
  const legacy = await lockRow(tx, 'job_quarantine', { job_name: jobName, payload_hash: keys.legacy })
  if (!legacy) return current
  const cutoff = Date.now() - windowMs
  const active = [current, legacy].filter(row => (parseSqlDateTime(row.window_start)?.getTime() ?? 0) >= cutoff)
  const first = active.map(row => parseSqlDateTime(row.window_start)!.getTime())
  const merged = {
    failure_count: active.reduce((total, row) => total + Number(row.failure_count), 0),
    window_start: first.length ? new Date(Math.min(...first)).toISOString() : now,
    quarantined_at: current.quarantined_at ?? legacy.quarantined_at,
  }
  await tx.updateTable('job_quarantine').set(merged).where('id', '=', Number(current.id)).execute()
  await tx.deleteFrom('job_quarantine').where('id', '=', Number(legacy.id)).execute()
  return { ...current, ...merged }
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
  const keys = payloadKeys(payload)
  const now = new Date()
  const nowStr = now.toISOString().slice(0, 19).replace('T', ' ')

  try {
    return await db.transaction(async (tx) => {
      const row = await payloadState(tx, jobName, keys, nowStr, windowMinutes * 60_000)
      if (row.quarantined_at) return true
      const start = parseSqlDateTime(row.window_start)?.getTime()
      const reset = start === undefined || now.getTime() - start >= windowMinutes * 60_000
      const count = (reset ? 0 : Number(row.failure_count)) + 1
      const quarantined = count >= maxFailures
      await tx.updateTable('job_quarantine').set({
        failure_count: count,
        window_start: reset ? nowStr : row.window_start,
        quarantined_at: quarantined ? nowStr : null,
      }).where('id', '=', Number(row.id)).execute()
      return quarantined
    }, sqliteWriteOptions())
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
  const keys = payloadKeys(payload)
  try {
    // Match either this exact payload hash OR the class-wide wildcard `*`
    // that `quarantineJob(name)` writes when called without a payload —
    // without the `*` arm a manual `queue:quarantine <name>` stored a row
    // that nothing ever matched, so class-wide quarantine never blocked.
    const row = await db
      .selectFrom('job_quarantine')
      .where('job_name', '=', jobName)
      .where('payload_hash', 'in', [keys.current, keys.legacy, '*'])
      .whereNotNull('quarantined_at')
      .select(['id', 'payload_hash'])
      .executeTakeFirst()
    if (row?.payload_hash === keys.legacy) {
      await db.transaction(tx => payloadState(tx, jobName, keys, new Date().toISOString(), 60 * 60_000), sqliteWriteOptions())
    }
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
  const keys = payload === undefined ? { current: '*', legacy: '*' } : payloadKeys(payload)
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')
  try {
    await db.transaction(async (tx) => {
      const row = await payloadState(tx, jobName, keys, nowStr, 60 * 60_000)
      await tx.updateTable('job_quarantine').set({ quarantined_at: nowStr }).where('id', '=', Number(row.id)).execute()
    }, sqliteWriteOptions())
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
    await db
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
    const rows = await db
      .selectFrom('job_quarantine')
      .whereNotNull('quarantined_at')
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
