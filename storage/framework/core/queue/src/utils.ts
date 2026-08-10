import type { QueueOption } from '@stacksjs/types'
import { createEnvelope, serializeEnvelope } from './envelope'

/**
 * Affected-row count from an UPDATE result, across every shape the query
 * builders in the wild return: Kysely's `numUpdatedRows` bigint,
 * bun-query-builder's `{ changes, lastInsertRowid }` object, or a plain
 * number. `Number({...})` is NaN, and `NaN > 0` is false — which made the
 * queue worker's CAS claim treat every SUCCESSFUL reservation as lost:
 * jobs were reserved then discarded, one per poll, forever, with nothing
 * processed and nothing logged (found on stacksjs/status production,
 * 2026-07-04, 1,600+ jobs stuck reserved).
 */
export function updatedRowCount(result: unknown): number {
  const raw = (result as { numUpdatedRows?: unknown } | null | undefined)?.numUpdatedRows
  if (raw === null || raw === undefined)
    return 0
  if (typeof raw === 'object')
    return Number((raw as { changes?: number | bigint }).changes ?? 0)
  return Number(raw)
}

/** The `jobs` row a scheduled dispatch becomes. */
export interface ScheduledJobRow {
  queue: string
  payload: string
  attempts: number
  available_at: number
  created_at: string
}

/**
 * Build the row `storeJob` writes, without writing it.
 *
 * Split out from `storeJob` so the shape that reaches the `jobs` table is
 * reachable in a test without a database — the wiring below it is one insert.
 *
 * Routed through `createEnvelope` rather than merely guarded
 * (stacksjs/stacks#2282 item 6). The object this used to build by hand was,
 * field for field, the PRE-#1884 v0 shape: `{ jobName, payload, options }`,
 * with no `envelopeVersion` and no `dispatchedAt`. Every scheduled dispatch —
 * this is the writer behind `scheduler.ts`'s tick and `triggerJob` — therefore
 * landed in the table looking like a job queued before the upgrade. The
 * worker's `parseEnvelope` took its `v0-implicit` branch for them, warning
 * that the migration window was closing about rows the CURRENT build had
 * written a moment earlier, and stamping each one `dispatchedAt: 1970-01-01`
 * because there was nothing to read — the one field "this job sat in the queue
 * for X" is measured from. Guarding the hand-built object would have bought
 * the better error message and left the shape drifted; there is no second wire
 * format here worth preserving.
 *
 * One coupling to keep in mind before touching this: `hasUnfinishedRun` finds a
 * job's queue row with `payload LIKE '%"jobName":"<name>"%'`, because `jobs`
 * has no name column. `createEnvelope` emits `jobName` first, so the pattern
 * matches exactly as it did — and it is wrapped in `%` on both sides, so it
 * would match wherever the key sat. That property is covered behaviourally in
 * `tests/envelope-json-contract.test.ts` rather than by grepping this file.
 */
export function buildScheduledJobRow(name: string, options: QueueOption): ScheduledJobRow {
  const envelope = createEnvelope(name, options.payload || {}, {
    queue: options.queue,
    tries: options.maxTries,
    timeout: options.timeout,
    // `QueueOption.backoff` also admits the `{ type, delay }` object form,
    // which the envelope has no field for and no worker reads. Narrowed the
    // same way both other drivers narrow it, rather than writing a shape the
    // far side would silently ignore.
    backoff: Array.isArray(options.backoff) ? options.backoff : undefined,
  })

  return {
    queue: options.queue || 'default',
    // Serialized before `storeJob` opens a connection, so a scheduled job with
    // an unserializable payload fails naming the job and the property instead
    // of throwing a bare `TypeError: JSON.stringify cannot serialize BigInt.`
    // out of the middle of a scheduler tick (stacksjs/stacks#2282 item 6).
    payload: serializeEnvelope(envelope),
    attempts: 0,
    available_at: generateUnixTimestamp(options.delay || 0),
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  }
}

export async function storeJob(name: string, options: QueueOption): Promise<void> {
  const row = buildScheduledJobRow(name, options)

  const { db } = await import('@stacksjs/database')

  await db
    .insertInto('jobs')
    .values(row)
    .execute()
}

function generateUnixTimestamp(secondsToAdd: number): number {
  const now = Date.now()
  return Math.floor((now / 1000) + secondsToAdd)
}
