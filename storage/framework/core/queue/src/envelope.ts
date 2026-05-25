/**
 * Unified job envelope (stacksjs/stacks#1884, Q-6 from #1872).
 *
 * Background: the database and redis queue drivers serialized jobs
 * differently:
 *
 *   - database: `{ jobName, payload, options }` JSON-stringified into
 *     the `jobs.payload` column
 *   - redis: `{ jobName, payload }` passed as bun-queue's `data` arg
 *     with options split into bun-queue's second arg
 *
 * Switching `QUEUE_DRIVER` mid-flight orphaned in-flight jobs because
 * the new worker couldn't deserialize the other shape. Fix: one
 * `JobEnvelope` shape, used by every driver's write AND read, with a
 * `envelopeVersion` field so a future shape change can be rolled out
 * without breaking in-flight jobs queued under the previous version.
 *
 * Backward-compat: `parseEnvelope` handles three shapes:
 *
 *   1. **v1 (this version)** — full envelope with `envelopeVersion: 1`
 *   2. **v0 implicit** — pre-fix shape (`{ jobName, payload, options? }`
 *      with no `envelopeVersion`). One-shot warn-and-process so the
 *      operator knows the migration window is closing.
 *   3. **Laravel legacy** — `{ job: 'App\\Jobs\\Foo', data }` carried
 *      over from the database-Laravel-port era. Same warn-and-process.
 *
 * Forward-compat: a `envelopeVersion` newer than `JOB_ENVELOPE_VERSION`
 * is logged and skipped (so a rolling deploy with a newer-shape envelope
 * doesn't crash old workers; they leave the row for the new workers to
 * pick up).
 */

/**
 * Current envelope version. Bump when you change the shape of
 * `JobEnvelope` in a way that older workers couldn't deserialize.
 *
 * - v1: jobName + payload + optional options + envelopeVersion +
 *       dispatchedAt
 */
export const JOB_ENVELOPE_VERSION = 1

/**
 * Per-job runtime options that travel with the envelope so a worker
 * processing the job knows how to apply them (timeout, retries,
 * backoff). The database driver previously embedded these in the
 * envelope; the redis driver lost them across the wire because they
 * went to bun-queue's separate options arg only.
 */
export interface JobEnvelopeOptions {
  queue?: string
  timeout?: number
  tries?: number
  backoff?: number | number[]
}

export interface JobEnvelope {
  jobName: string
  payload: unknown
  options?: JobEnvelopeOptions
  envelopeVersion: number
  /** ISO 8601 UTC. Useful for diagnosing \"job sat in queue for X\" cases. */
  dispatchedAt: string
}

/**
 * Construct a fresh envelope for an outgoing dispatch. Both drivers
 * call this — single source of truth for the on-the-wire shape.
 */
export function createEnvelope(
  jobName: string,
  payload: unknown,
  options?: JobEnvelopeOptions,
): JobEnvelope {
  return {
    jobName,
    payload,
    options,
    envelopeVersion: JOB_ENVELOPE_VERSION,
    dispatchedAt: new Date().toISOString(),
  }
}

/**
 * Result of attempting to parse an arbitrary input into a
 * `JobEnvelope`. Discriminated so callers don't have to inspect
 * the version field directly.
 */
export type ParsedEnvelope =
  | { ok: true, envelope: JobEnvelope, source: 'v1' | 'v0-implicit' | 'laravel-legacy' }
  | { ok: false, reason: 'malformed' | 'unknown-version' | 'missing-job-name', detail?: string }

// Warn-once per process so a flood of legacy-shape jobs only logs
// the migration-window message a single time. Per-source bucket so
// each fallback path's warning is independent.
const warned = new Set<string>()
function warnOnce(source: string, message: string): void {
  if (warned.has(source)) return
  warned.add(source)
  // eslint-disable-next-line no-console
  console.warn(message)
}

/**
 * Test-only: clear the warn-once state. Production callers never
 * need this.
 */
export function clearEnvelopeWarnings(): void {
  warned.clear()
}

/**
 * Parse an opaque value into a `JobEnvelope`. Accepts strings (which
 * are JSON-parsed) or objects (which are inspected directly) —
 * the database driver passes a JSON string; the redis driver passes
 * the already-deserialized object that bun-queue gave back.
 *
 * Returns a discriminated result so caller code doesn't have to
 * pattern-match on the version field. Forward-compatible: an
 * unknown-but-newer version returns `{ ok: false, reason:
 * 'unknown-version' }` so the worker can leave the row for a
 * newer-build worker.
 */
export function parseEnvelope(raw: unknown): ParsedEnvelope {
  let obj: Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>
    }
    catch {
      return { ok: false, reason: 'malformed', detail: 'not valid JSON' }
    }
  }
  else if (raw && typeof raw === 'object') {
    obj = raw as Record<string, unknown>
  }
  else {
    return { ok: false, reason: 'malformed', detail: `expected string or object, got ${typeof raw}` }
  }

  // v1: explicit envelopeVersion === 1
  if (obj.envelopeVersion === JOB_ENVELOPE_VERSION) {
    if (typeof obj.jobName !== 'string') {
      return { ok: false, reason: 'missing-job-name' }
    }
    const envelope: JobEnvelope = {
      jobName: obj.jobName,
      payload: obj.payload,
      options: (obj.options as JobEnvelopeOptions | undefined) ?? undefined,
      envelopeVersion: JOB_ENVELOPE_VERSION,
      dispatchedAt: typeof obj.dispatchedAt === 'string' ? obj.dispatchedAt : new Date(0).toISOString(),
    }
    return { ok: true, envelope, source: 'v1' }
  }

  // Forward-compat: unknown-but-numeric newer version → skip this worker.
  if (typeof obj.envelopeVersion === 'number' && obj.envelopeVersion > JOB_ENVELOPE_VERSION) {
    return {
      ok: false,
      reason: 'unknown-version',
      detail: `envelopeVersion=${obj.envelopeVersion}, this worker speaks v${JOB_ENVELOPE_VERSION}`,
    }
  }

  // v0 implicit: pre-fix shape — `{ jobName, payload, options? }`
  // with no envelopeVersion field. Promote into a v1 envelope so
  // downstream code can stop branching on shape.
  if (typeof obj.jobName === 'string') {
    warnOnce(
      'v0-implicit',
      '[queue/envelope] Processing pre-#1884 job envelope without envelopeVersion. '
      + 'In-flight jobs from before the upgrade will continue to work; new dispatches '
      + 'use the v1 shape automatically.',
    )
    return {
      ok: true,
      envelope: {
        jobName: obj.jobName,
        payload: obj.payload,
        options: (obj.options as JobEnvelopeOptions | undefined) ?? undefined,
        envelopeVersion: JOB_ENVELOPE_VERSION,
        dispatchedAt: typeof obj.dispatchedAt === 'string' ? obj.dispatchedAt : new Date(0).toISOString(),
      },
      source: 'v0-implicit',
    }
  }

  // Laravel legacy: `{ job: 'App\\Jobs\\Foo', data }` from the
  // database-Laravel-port era. Synthesize a v1 envelope so the
  // worker can dispatch it through the same runJob path.
  if (typeof obj.job === 'string') {
    warnOnce(
      'laravel-legacy',
      '[queue/envelope] Processing Laravel-legacy job envelope (`{ job, data }` shape). '
      + 'Will continue to process but the queue table contains migration-era rows — '
      + 'consider flushing once they drain.',
    )
    // Strip the `App\\Jobs\\` prefix if present so the file-resolver
    // can find `app/Jobs/<Name>.ts`.
    const jobName = (obj.job).replace(/^App\\+Jobs\\+/, '').replace(/^.*\\/, '')
    return {
      ok: true,
      envelope: {
        jobName,
        payload: obj.data,
        options: undefined,
        envelopeVersion: JOB_ENVELOPE_VERSION,
        dispatchedAt: new Date(0).toISOString(),
      },
      source: 'laravel-legacy',
    }
  }

  return { ok: false, reason: 'missing-job-name' }
}
