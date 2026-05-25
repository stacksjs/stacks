/**
 * Job dispatch idempotency (stacksjs/stacks#1872 Q-8).
 *
 * Background: nothing in the dispatch path prevented the same job
 * from being enqueued twice. A double-clicked button, a retry inside
 * a webhook handler, or a `dispatchIf(condition, ...)` that re-fires
 * after a config reload would enqueue duplicate work — and once
 * in-flight, the worker had no way to recognize the duplication.
 *
 * Fix: callers attach an `idempotencyKey` via `JobDispatchOptions`
 * (or the new `.withIdempotencyKey(key)` chainable). Before
 * dispatching to the driver, `dispatch()` consults a dedup side-
 * table — hit means we skip the dispatch and return; miss means
 * we dispatch and record the key.
 *
 * Mirrors the dedup tables we ship across the framework:
 *   - `order_idempotency`        (stacksjs/stacks#1879 Co-3)
 *   - `email_idempotency`        (stacksjs/stacks#1871 M-8)
 *   - `stripe_webhook_events`    (stacksjs/stacks#1879 Co-17)
 *
 * Same insert-or-skip semantics, same warn-once-and-degrade when
 * the table doesn't exist yet so apps that haven't run the
 * migration aren't broken by the new behavior.
 *
 * Schema (provision via the framework migration that introduces
 * the `job_idempotency` table):
 *
 *   - `idempotency_key` TEXT NOT NULL UNIQUE
 *   - `job_name`        TEXT NOT NULL
 *   - `queue`           TEXT
 *   - `dispatched_at`   TEXT NOT NULL
 *
 * Failed dispatches are NOT recorded — if the driver insert throws,
 * the caller can retry with the same key and the next attempt is
 * the one that should land.
 */

let warnedAboutMissingJobIdempotencyTable = false

function warnOnceAboutMissingTable(): void {
  if (warnedAboutMissingJobIdempotencyTable) return
  warnedAboutMissingJobIdempotencyTable = true
  // eslint-disable-next-line no-console
  console.warn(
    '[queue/idempotency] job_idempotency table missing — idempotency keys are accepted but NOT enforced. '
    + 'Run migrations to enable dedup.',
  )
}

function isMissingTableError(err: unknown): boolean {
  const msg = (err as { message?: string } | null)?.message ?? ''
  return msg.includes('no such table') || msg.includes("doesn't exist")
}

/**
 * Check whether a job has already been dispatched under this key.
 * Returns `true` when the dedup row exists (skip dispatch), `false`
 * when it doesn't (proceed with dispatch). Degrades to "always
 * false" with a startup warn when the table is missing.
 */
export async function hasDispatchedKey(key: string): Promise<boolean> {
  try {
    const { db } = await import('@stacksjs/database')
    const row = await (db as any)
      .selectFrom('job_idempotency')
      .where('idempotency_key', '=', key)
      .select(['idempotency_key'])
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
 * Record that a job was successfully dispatched under this key.
 * Called after the driver-side insert/push succeeds. No-op when
 * the table is missing; collisions (concurrent dispatch of the
 * same key) are swallowed because the existing row is already
 * what the next lookup would return.
 */
export async function recordDispatchedKey(
  key: string,
  jobName: string,
  queue?: string,
): Promise<void> {
  try {
    const { db } = await import('@stacksjs/database')
    await (db as any)
      .insertInto('job_idempotency')
      .values({
        idempotency_key: key,
        job_name: jobName,
        queue: queue ?? 'default',
        dispatched_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      })
      .execute()
  }
  catch (err) {
    if (isMissingTableError(err)) {
      warnOnceAboutMissingTable()
      return
    }
    const msg = (err as { message?: string } | null)?.message ?? ''
    if (msg.includes('UNIQUE constraint') || msg.includes('Duplicate entry')) return
    throw err
  }
}
