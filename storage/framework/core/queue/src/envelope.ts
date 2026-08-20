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
 *
 * Wire format: JSON, with everything that implies for a payload. What
 * survives a round trip, what is silently changed on the way, and what throws
 * is documented under "JSON round-trip contract" above `serializeEnvelope`.
 */

/**
 * Current envelope version. Bump when you change the shape of
 * `JobEnvelope` in a way that older workers couldn't deserialize.
 *
 * - v1: jobName + payload + optional options + envelopeVersion +
 *       dispatchedAt, plus an optional `traceId`. Added without a version bump
 *       because it is additive and optional: an old worker reading a new
 *       envelope ignores the field, and a new worker reading an old one mints
 *       an id exactly as it did before. Bumping would have stalled in-flight
 *       jobs during a rolling deploy for a field nothing requires.
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
  /**
   * The trace id of whatever dispatched this.
   *
   * A worker runs in another process, so the AsyncLocalStorage the trace lives
   * in during a request cannot reach it - the id has to travel *in the row*.
   * Without this, `runJob` mints a fresh id and the connection between "this
   * request was slow" and "because the job it queued took nine seconds" is lost
   * at exactly the moment somebody is trying to make it.
   *
   * Optional, because a job dispatched by the scheduler has no parent request.
   * Those get a minted id, which at least correlates the job to itself.
   */
  traceId?: string
}

/**
 * Construct a fresh envelope for an outgoing dispatch. Both drivers
 * call this — single source of truth for the on-the-wire shape.
 */
export function createEnvelope(
  jobName: string,
  payload: unknown,
  options?: JobEnvelopeOptions,
  traceId?: string,
): JobEnvelope {
  return {
    jobName,
    payload,
    options,
    envelopeVersion: JOB_ENVELOPE_VERSION,
    dispatchedAt: new Date().toISOString(),
    ...(traceId ? { traceId } : {}),
  }
}

/**
 * JSON round-trip contract — what a payload is worth on the other side
 * (stacksjs/stacks#2282, item 6).
 *
 * The envelope travels as JSON and only as JSON: the database driver writes it
 * into `jobs.payload` as text, and the redis driver hands it to bun-queue,
 * which stringifies it on the way into redis. A payload is therefore subject
 * to JSON's type system rather than JavaScript's, and the worker on the far
 * side revives nothing. Precisely what that costs:
 *
 *   - `undefined` — the property is DROPPED. `{ a: 1, b: undefined }` arrives
 *     as `{ a: 1 }`, so `'b' in payload` flips from true to false. Inside an
 *     array it becomes `null` instead: `[1, undefined]` → `[1, null]`.
 *   - `Date` — becomes its ISO 8601 STRING (via `Date.prototype.toJSON`) and
 *     stays a string; a handler calling `.getTime()` on it throws. Send
 *     `date.toISOString()` or an epoch number on purpose and parse it in the
 *     handler, so the conversion is visible at both ends.
 *   - `Map` / `Set` — become `{}`. Their contents are gone, silently. Send an
 *     array or a plain object.
 *   - class instances — arrive as plain objects: own enumerable properties
 *     only, no prototype, so methods and `instanceof` are gone. Model
 *     instances especially should never be a payload; send the id.
 *   - functions and symbol values — dropped exactly like `undefined`. Symbol
 *     keys are ignored outright.
 *   - `NaN`, `Infinity`, `-Infinity` — become `null`. `-0` becomes `0`.
 *   - numbers — IEEE-754 doubles. Integers past 2^53 lose precision with no
 *     error whatsoever, which is the trap `BigInt` exists to avoid and the
 *     reason large ids are safer sent as strings.
 *   - `BigInt` — THROWS. Guarded by `serializeEnvelope` below rather than left
 *     to blow up from inside `JSON.stringify`.
 *   - circular references — THROW, with no fix but restructuring the payload.
 *   - anything with a `toJSON()` — is whatever `toJSON()` returns. That is how
 *     `Date` becomes a string, and it applies to your own classes too.
 *
 * Everything else — strings, booleans, `null`, finite numbers, arrays, plain
 * objects, and key order within them — survives unchanged.
 *
 * One trap worth naming: `QUEUE_DRIVER=sync` runs the handler in-process and
 * never serializes anything, so a payload that violates any of the above works
 * perfectly in development and changes shape (or throws) the moment the app
 * runs against `database` or `redis`.
 *
 * Rule of thumb: a payload should be data you would be content to read in a
 * log line. Send ids, not objects. That is also what keeps a job replayable
 * from the dead-letter queue hours after the things it referred to changed.
 */

/**
 * Serialize an envelope for the wire, turning JSON's two hard failures into
 * errors that say what to do about them.
 *
 * On a `BigInt` this FAILS rather than coerces, deliberately. The alternatives
 * were to stringify it (`"9007199254740993"`), which is silently lossy in the
 * *type* — the worker gets a string, `typeof` flips, and arithmetic in the
 * handler either concatenates or throws, in another process, with nothing
 * pointing back at the dispatch that caused it — or to invent a tagged wrapper
 * (`{ $bigint: '…' }`), which is a private serialization format that every
 * reader of the `jobs` table and every non-Stacks consumer of the redis queue
 * would then have to know about. Both trade a loud, local, fixable failure for
 * a quiet, remote, strange one. The caller knows whether `String()` or
 * `Number()` is the right conversion for their value; the framework does not.
 */
export function serializeEnvelope(envelope: JobEnvelope): string {
  try {
    return JSON.stringify(envelope)
  }
  catch (err) {
    // Diagnosed only on the failing path: finding the offending property costs
    // a second walk of the payload, and the happy path here is every dispatch
    // the application ever makes.
    throw serializationError(envelope, err)
  }
}

/**
 * Check an envelope against the contract above without keeping the JSON.
 *
 * For the driver that serializes the envelope somewhere we cannot see: the
 * redis driver hands the object to bun-queue, which stringifies it several
 * layers down, so without this the failure surfaces there as the bare
 * TypeError, naming neither the job nor the property.
 *
 * Callers run this BEFORE they acquire anything (stacksjs/stacks#2282 item 6).
 * A guard placed after the queue was constructed still produced the better
 * message, but only once a connection had been opened for a job that was never
 * going to be enqueued.
 */
export function assertEnvelopeSerializable(envelope: JobEnvelope): void {
  serializeEnvelope(envelope)
}

/**
 * Turn a `JSON.stringify` failure into something an operator can act on.
 *
 * Bun's own message is `JSON.stringify cannot serialize BigInt.` — true, and
 * useless: it names neither the job nor the property, and the stack points
 * into the driver rather than at the dispatch that built the payload.
 *
 * Which of the three messages below a failure earns is decided by the CAUSE,
 * never by what a walk of the payload happens to find (stacksjs/stacks#2282
 * item 6). The first cut asked only "is there a BigInt anywhere in this
 * graph?", so a payload whose `toJSON()` threw — and which merely also held a
 * BigInt somewhere `JSON.stringify` never reached — was reported as a BigInt
 * problem, sending the operator to convert a property that was serializing
 * perfectly well. The walk now runs only to supply the PATH for a failure the
 * cause has already identified.
 */
function serializationError(envelope: JobEnvelope, cause: unknown): Error {
  const seeContract = 'See the JSON round-trip contract in @stacksjs/queue\'s src/envelope.ts.'

  if (isBigIntFailure(cause)) {
    // Only now is the second walk worth paying for, and only to name a
    // property the cause has already told us exists.
    let offender: { path: string, value: bigint } | null = null
    try {
      offender = findBigInt(envelope, '', new Set())
    }
    catch {
      // A getter in the payload that throws when read. We still know a BigInt
      // is what broke stringify; we just cannot point at which one.
    }

    const where = offender
      ? `\`${offender.path}\` is a BigInt (${offender.value}n)`
      : 'it holds a BigInt'

    return new Error(
      `[queue] Job "${envelope.jobName}" was not dispatched: ${where}, `
      + 'and job envelopes travel as JSON, which cannot represent one. Convert it where you dispatch - '
      + '`String(value)` keeps every digit, `Number(value)` is exact below 2^53 - and convert it back inside '
      + `the job handler. ${seeContract}`,
      { cause },
    )
  }

  if (isCircularFailure(cause)) {
    return new Error(
      `[queue] Job "${envelope.jobName}" was not dispatched: its payload contains a circular reference, `
      + 'which JSON cannot represent. Send the ids of the things the payload points at rather than the '
      + `objects themselves - that also keeps the job replayable once those objects have changed. ${seeContract}`,
      { cause },
    )
  }

  /*
   * Neither of the two failures JSON has of its own, so the throw came out of
   * the payload's own code — a `toJSON()` or a property getter. The previous
   * version appended "a circular reference is the usual cause" here
   * unconditionally, which for a throwing getter is simply false and costs the
   * reader a hunt for a cycle that does not exist. Report what threw and stop
   * guessing.
   */
  const detail = cause instanceof Error ? cause.message : String(cause)
  return new Error(
    `[queue] Job "${envelope.jobName}" was not dispatched: serializing its payload threw (${detail}). `
    + 'JSON rejects only two things on its own and this was neither, so the throw came from the payload - '
    + `a \`toJSON()\` or a property getter. ${seeContract}`,
    { cause },
  )
}

/**
 * Was the BigInt what threw, as opposed to something else on the way through?
 *
 * Matched on the type named inside a `TypeError` rather than on either engine's
 * exact sentence: JSC and Bun say `JSON.stringify cannot serialize BigInt.`,
 * V8 says `Do not know how to serialize a BigInt`. Both name the type; nothing
 * else about the two messages agrees.
 *
 * A `toJSON()` that threw a `TypeError` mentioning BigInt would land here too.
 * That is accepted: the only way to rule it out is to re-run `JSON.stringify`
 * over a BigInt-free projection of the payload, which is a second full
 * serialize of arbitrary user data to sharpen a message that would still be
 * pointing at a real BigInt in the graph.
 */
function isBigIntFailure(cause: unknown): boolean {
  return cause instanceof TypeError && /bigint/i.test(cause.message)
}

/**
 * Was it the cycle? Same reasoning as `isBigIntFailure`, different wordings:
 * JSC and Bun say `JSON.stringify cannot serialize cyclic structures.`, V8 says
 * `Converting circular structure to JSON …`, SpiderMonkey says
 * `cyclic object value`.
 */
function isCircularFailure(cause: unknown): boolean {
  return cause instanceof TypeError && /circular|cyclic/i.test(cause.message)
}

/**
 * First BigInt in the graph, depth-first, with the path that reaches it —
 * `payload.invoice.cents`, `payload.ids[3]`.
 *
 * `seen` is not an optimization. This walk runs *because* stringify threw, and
 * a payload is perfectly capable of holding a BigInt AND a cycle — stringify
 * reports whichever it reaches first — so the walk must not hang on the very
 * structure it was called to explain. It reads the raw graph rather than
 * post-`toJSON` values, so in the pathological case where a `toJSON` would have
 * hidden the BigInt the path is approximate — a near-miss pointer beats none,
 * and it only ever runs after a genuine failure.
 */
function findBigInt(value: unknown, path: string, seen: Set<object>): { path: string, value: bigint } | null {
  if (typeof value === 'bigint')
    return { path: path || 'envelope', value }

  if (!value || typeof value !== 'object')
    return null

  if (seen.has(value))
    return null
  seen.add(value)

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findBigInt(value[i], `${path}[${i}]`, seen)
      if (hit)
        return hit
    }
    return null
  }

  for (const [key, child] of Object.entries(value)) {
    const hit = findBigInt(child, path ? `${path}.${key}` : key, seen)
    if (hit)
      return hit
  }

  return null
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
      // Carried through, not rebuilt away. This function reconstructs the
      // envelope field by field rather than spreading, so anything it does not
      // name is silently dropped - which is what happened to the trace id, and
      // the symptom was every job logging under an id of its own.
      ...(typeof obj.traceId === 'string' && obj.traceId ? { traceId: obj.traceId } : {}),
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
        ...(typeof obj.traceId === 'string' && obj.traceId ? { traceId: obj.traceId } : {}),
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
      + 'Will continue to process but the queue table contains migration-era rows - '
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
