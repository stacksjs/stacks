# Durable queue workflows

Read this for transaction boundaries, deduplication, persisted callbacks and
failure recovery. Source root: `storage/framework/core/queue/src/`.

## Commit-aware dispatch

```ts
import { db } from '@stacksjs/database/runtime'
import { job } from '@stacksjs/queue'

await db.transaction(async () => {
  // Persist the application's state transition here.
  await job('SendEmailJob', {
    message: { to: 'user@example.com', subject: 'Welcome', text: 'Welcome, Ada.' },
    driver: 'log',
  })
    .withIdempotencyKey('welcome:user-7:v1')
    .afterCommit()
    .dispatch()
})
```

SendEmailJob is bundled; the example log transport avoids external delivery.
Use the selected application transport for actual mail. Inside db.transaction,
the builder defers dispatch until commit by
default. Rollback discards buffered dispatches. `.afterCommit()` is explicit
intent; outside a transaction it warns and dispatches immediately.
`.withoutCommit()` opts into a side effect before commit. This is not a durable
transactional outbox across a process crash between commit and dispatch.

`.withIdempotencyKey(key)` uses `job_idempotency` to claim dispatch atomically.
The key identifies one intended dispatch, not merely a reusable job name; a
failed dispatch releases its claim. Apply the supporting migration and inspect
missing-table behavior before relying on deduplication. A dispatch claim does
not make the handler's external side effects exactly-once; handlers still need
idempotency at their own durable boundary.

Source: `job.ts`, `idempotency.ts`; database after-commit callbacks are owned by
`core/database/src/`. Evidence: `tests/idempotency-claim.test.ts`,
`idempotency-dialects.test.ts`, `job-builder.test.ts` and integration tests.

## Envelope, context and tracing

Database and Redis use the versioned JobEnvelope: jobName, payload, options,
envelopeVersion, dispatchedAt and optional traceId/context. `.withContext(value)`
passes context as the second argument to handle on sync and durable drivers.
Request trace IDs travel in the envelope; a worker's own request scope cannot
inherit an AsyncLocalStorage from another process.

Use `assertEnvelopeSerializable`/`serializeEnvelope` to inspect the JSON wire
contract. Objects containing undefined properties lose them; undefined array
entries and non-finite numbers become null; Dates become ISO strings; custom
classes lose prototypes; BigInt and cycles throw with diagnostic paths.
These helpers detect a serialization failure, not every lossy conversion.
Payloads should be explicit data with identifiers, not a model instance or an
executable closure. Legacy envelope forms are parsed with warnings; future
versions are left for a worker that understands them.

Source: `envelope.ts`. Evidence: `tests/envelope-json-contract.test.ts`,
`envelope-trace.test.ts`, `job-context.test.ts` and `sync-trace.test.ts`.

## Batch callbacks that survive a worker restart

Inline `.then(fn)/.catch(fn)/.finally(fn)/.progress(fn)` callbacks are process-local
conveniences. Persistent terminal handlers are descriptors stored in database
columns or Redis, then fired by the worker that wins terminal finalization:

```ts
import { Batch } from '@stacksjs/queue'

const pending = Batch.create([]).name('import')
  .thenHandler({ kind: 'module', module: './app/BatchHandlers.ts', export: 'done' })
  .finallyHandler({ kind: 'job', name: 'CleanupImport', payload: { importId: 7 } })
```

Replace the descriptors with real exported modules/jobs and supply the actual
batch jobs before dispatch. Native methods are thenHandler/catchHandler/
finallyHandler; each slot holds one descriptor. Job handlers receive an added
batch ID in their payload; module functions receive `(payload, batchId)`.
Old batch schemas missing the handler columns warn and cannot promise restart
persistence. A terminal winner avoids duplicate finalization in the retained
storage contract, but downstream external effects still need their own retry
and idempotency policy.

Source: `batch.ts`; evidence: `tests/batch-persistent-handlers.test.ts`,
`batch-add-races.test.ts`, `batch-redis-lifecycle.test.ts` and
`batch-add-atomicity.test.ts`.

## Progress and cancellation

setJobProgress(id, percent, message?), getJobProgress(id), cancelJob(id),
isJobCancelled(id) and clearJobState(id) are native helpers. Percent means 0-100;
one means 1%, not 100%. Cancellation is cooperative: the running handler checks
the flag between safe units of work. It does not forcibly interrupt a promise.

Current `job-progress.ts` imports the public default cache singleton, which is
memory, with one-hour entries. Do not claim those helpers share state across
processes merely because config.cache selects Redis. A separate application
progress store or explicit shared integration is needed for that topology.
Evidence: `tests/job-progress.test.ts` and `job-progress-cache.test.ts`.

## Failure controls and operator actions

The public entry exposes listDeadLetterJobs/moveToDeadLetter/retryDeadLetterJob/
purgeDeadLetterJobs; poison detection and quarantine helpers; and
pauseQueue/resumeQueue/isCircuitOpen/listCircuitState plus circuit record helpers.
Read `dead-letter.ts`, `poison.ts`, `circuit-breaker.ts` and their exported
option/filter types before building an operator action around them. A retry,
purge or unquarantine changes real work state and needs the task's authorization.
CLI inventory and flags come from `buddy list` and `buddy queue:* --help`.

Workers apply retry options, backoff and failed/dead-letter bookkeeping.
Timeout signaling cannot roll back an external operation already issued by a
handler. Redis retry behavior and database retry behavior have their own source
paths. Health/metrics and process-local event subscribers are not authoritative
state for all workers in a fleet.

Evidence: `tests/dlq-quarantine-wiring.test.ts`, `failure-path-correctness.test.ts`,
`worker-declared-retries.test.ts`, `graceful-shutdown-wiring.test.ts` and
`worker-queues.test.ts`. Driver status comes from `core/config/src/capabilities.ts`.
