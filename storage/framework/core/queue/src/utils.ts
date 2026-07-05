import type { QueueOption } from '@stacksjs/types'

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

export async function storeJob(name: string, options: QueueOption): Promise<void> {
  const payloadJson = JSON.stringify({
    jobName: name,
    payload: options.payload || {},
    options: {
      queue: options.queue,
      tries: options.maxTries,
      timeout: options.timeout,
      backoff: options.backoff,
    },
  })

  const { db } = await import('@stacksjs/database')

  await db
    .insertInto('jobs')
    .values({
      queue: options.queue || 'default',
      payload: payloadJson,
      attempts: 0,
      available_at: generateUnixTimestamp(options.delay || 0),
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    })
    .execute()
}

function generateUnixTimestamp(secondsToAdd: number): number {
  const now = Date.now()
  return Math.floor((now / 1000) + secondsToAdd)
}
