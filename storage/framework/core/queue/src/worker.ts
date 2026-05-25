/**
 * Queue Worker Functions
 *
 * Functions for managing queue workers and processing jobs.
 * Supports both database and Redis (bun-queue) drivers.
 */

import type { Result } from '@stacksjs/error-handling'
import { err, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import process from 'node:process'
import { parseEnvelope } from './envelope'

// Prevent unhandled rejections from crashing the worker
process.on('unhandledRejection', (reason, _promise) => {
  log.error(`Unhandled Rejection: ${reason}`)
})

process.on('uncaughtException', (error) => {
  log.error(`Uncaught Exception: ${error.message}`)
})

// Environment variables
import { env as envVars } from '@stacksjs/env'

// Worker state
let activeJobCount = 0
let workerRunning = false
let workerId = ''

/**
 * In-flight job promises currently being awaited by the worker loop.
 * Tracked so `stopProcessor()` can wait for them to settle within the
 * grace window before the process exits — a hard kill mid-`handle()`
 * leaves the job stuck in `reserved_at` and (if past max attempts)
 * loses customer data. See stacksjs/stacks#1872 Q-10.
 */
const inFlightJobs = new Set<Promise<unknown>>()

/**
 * Track a job promise so {@link stopProcessor} can await it. The
 * promise is removed from the set when it settles (regardless of
 * outcome) so the set stays bounded.
 */
function trackInFlight<T>(promise: Promise<T>): Promise<T> {
  inFlightJobs.add(promise)
  promise.finally(() => inFlightJobs.delete(promise))
  return promise
}

/**
 * Reservation TTL — `reserved_at` rows older than this are eligible
 * for the sweep that requeues them. Default 1h; override via
 * `STACKS_QUEUE_RESERVATION_TTL_SEC`. Sized so a normal long-running
 * job (e.g. video transcode) finishes well under the window, but a
 * crashed worker's orphaned reservation isn't stranded forever.
 * See stacksjs/stacks#1872 Q-2.
 */
function getReservationTtlSec(): number {
  const raw = process.env.STACKS_QUEUE_RESERVATION_TTL_SEC
  const n = raw === undefined ? Number.NaN : Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : 3600
}

/**
 * Sweep frequency — how often the database loop checks for orphaned
 * reservations. Default 60s; override via
 * `STACKS_QUEUE_SWEEP_INTERVAL_SEC`. Cheap (one indexed UPDATE), so
 * running it frequently is fine.
 */
function getSweepIntervalMs(): number {
  const raw = process.env.STACKS_QUEUE_SWEEP_INTERVAL_SEC
  const n = raw === undefined ? Number.NaN : Number.parseInt(raw, 10)
  return (Number.isFinite(n) && n > 0 ? n : 60) * 1000
}

/**
 * Release any job whose `reserved_at` is older than the reservation
 * TTL — its worker presumably died mid-handle and the row is stuck.
 * Resets `reserved_at` to null and bumps `available_at` to now so the
 * next poll re-fetches it. Attempts counter is left intact (the row
 * already counted the original try; the next pickup will increment
 * again per the standard atomic-claim path).
 *
 * Returns the number of rows requeued — caller logs the count when
 * non-zero so the operator notices recurring crash patterns.
 *
 * See stacksjs/stacks#1872 Q-2.
 */
async function sweepStaleReservations(): Promise<number> {
  const ttlSec = getReservationTtlSec()
  const cutoff = Math.floor(Date.now() / 1000) - ttlSec
  const now = Math.floor(Date.now() / 1000)
  try {
    const { db } = await import('@stacksjs/database')
    const result = await db
      .updateTable('jobs')
      .set({ reserved_at: null, available_at: now })
      .where('reserved_at', '<=', cutoff)
      .executeTakeFirst()
    const requeued = Number((result as { numUpdatedRows?: number | bigint })?.numUpdatedRows ?? 0)
    if (requeued > 0) {
      log.warn(
        `[queue] Requeued ${requeued} job(s) whose reservation exceeded the `
        + `${ttlSec}s TTL — likely victims of a worker crash. Set `
        + `STACKS_QUEUE_RESERVATION_TTL_SEC to tune.`,
      )
    }
    return requeued
  }
  catch (error) {
    log.error('[queue] Reservation sweep failed', { reason: error instanceof Error ? error.message : String(error) })
    return 0
  }
}

/**
 * Determine whether an error from a job handler should be retried.
 *
 * "Non-retryable" means: re-running the same job with the same payload will
 * fail the same way every time. That's the case for client-shape errors
 * (validation failures, 4xx HttpErrors, malformed input) — retrying just
 * thrashes the queue. We DO retry on 5xx, network blips, and unknown errors.
 */
function isNonRetryableError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const status = (e as { status?: unknown; statusCode?: unknown }).status
    ?? (e as { statusCode?: unknown }).statusCode
  if (typeof status === 'number' && status >= 400 && status < 500) return true
  // Heuristic: validation failures from @stacksjs/validation throw HttpError(422).
  // We catch it via the status check above; the name fallback covers cases
  // where the error was wrapped or rethrown without preserving the prototype.
  const name = (e as { name?: unknown }).name
  if (typeof name === 'string' && (name === 'ValidationError' || name === 'ModelNotFoundError')) return true
  return false
}

/**
 * Get the queue driver from environment
 */
function getQueueDriver(): string {
  return envVars.QUEUE_DRIVER || 'sync'
}

/**
 * Start the queue processor (worker)
 * This is the main function called by `buddy queue:work`
 */
export async function startProcessor(
  queueName?: string,
  options: { concurrency?: number } = {},
): Promise<Result<undefined, Error>> {
  try {
    log.info('Starting queue processor...')

    workerRunning = true
    workerId = `worker-${process.pid}-${Date.now()}`
    const concurrency = options.concurrency || 1
    const queueDriver = getQueueDriver()

    const { getWorkerTracker, getGlobalMetrics } = await import('./events')
    getGlobalMetrics() // ensure metrics are listening
    getWorkerTracker().register(workerId, queueName || 'default')

    if (queueDriver === 'redis') {
      log.info('Using Redis queue driver (bun-queue)')
      await processJobsFromRedis(queueName || 'default', concurrency)
      return ok(undefined)
    }

    // Database driver (default)
    let queues: string[]
    if (queueName) {
      queues = [queueName]
    }
    else {
      queues = await getAllQueues()
      if (queues.length === 0) {
        queues = ['default']
      }
    }

    log.info(`Processing queues: ${queues.join(', ')}`)
    await processJobsFromDatabase(queues, concurrency)

    return ok(undefined)
  }
  catch (error) {
    workerRunning = false
    return err(error as Error)
  }
}

/**
 * Get all unique queue names from the jobs table
 */
async function getAllQueues(): Promise<string[]> {
  try {
    const { db } = await import('@stacksjs/database')
    // Typed equivalent of `SELECT DISTINCT queue FROM jobs`
    // (stacksjs/stacks#1872 Q-14). Pre-fix this went through a
    // `rawQuery` cast to escape the simplified `Db` surface — works
    // at runtime but bypasses every type check, so a `jobs` schema
    // rename would silently break here. The Kysely builder handles
    // DISTINCT directly and stays typed end-to-end.
    const rows = await (db as any)
      .selectFrom('jobs')
      .select('queue')
      .distinct()
      .execute() as Array<{ queue: string | null }>
    const queues = rows.map(r => r.queue).filter((q): q is string => Boolean(q))
    return queues.length > 0 ? queues : ['default']
  }
  catch {
    return ['default']
  }
}

/**
 * Process jobs from the database (jobs table)
 * This is the main processing loop for database-backed queues
 */
async function processJobsFromDatabase(initialQueues: string[], concurrency: number): Promise<void> {
  log.info(`Listening for jobs...`)

  let queues = initialQueues
  let lastQueueRefresh = Date.now()
  const queueRefreshInterval = 10000 // Refresh queue list every 10 seconds
  let lastSweep = Date.now()
  const sweepIntervalMs = getSweepIntervalMs()

  // Run an initial sweep before the polling loop starts. Without this
  // the first sweep is one full interval away — long enough for a
  // restarted worker to leave a previous crash's reservations idle.
  await sweepStaleReservations()

  while (workerRunning) {
    try {
      // Periodically refresh the list of queues to pick up new ones
      const now = Date.now()
      if (now - lastQueueRefresh > queueRefreshInterval) {
        try {
          const refreshedQueues = await getAllQueues()
          if (refreshedQueues.length > 0) {
            queues = refreshedQueues
          }
        }
        catch {
          // Ignore queue refresh errors
        }
        lastQueueRefresh = now
      }

      // Reservation sweep — requeue jobs whose reserved_at exceeds
      // the TTL (stacksjs/stacks#1872 Q-2). Cheap UPDATE, so we run
      // it in-line with the poll loop rather than spawning a separate
      // timer that would need its own lifecycle management.
      if (now - lastSweep > sweepIntervalMs) {
        await sweepStaleReservations()
        lastSweep = now
      }

      for (const queueName of queues) {
        let jobs: any[] = []
        try {
          jobs = await fetchPendingJobs(queueName, concurrency)
        }
        catch {
          // Ignore fetch errors, will retry next cycle
          continue
        }

        for (const job of jobs) {
          try {
            log.info(`Processing job ${job.id} from queue "${queueName}"`)
            await trackInFlight(processJob(job))
          }
          catch {
            // processJob should never throw, but just in case
            log.error(`Unexpected error processing job ${job.id}`)
          }
        }
      }

      // Sleep between polling cycles
      await sleep(1000)
    }
    catch {
      // Should never reach here, but keep the loop running
      await sleep(3000)
    }
  }
}

/**
 * Fetch pending jobs from the database
 */
async function fetchPendingJobs(queueName: string, limit: number): Promise<any[]> {
  const now = Math.floor(Date.now() / 1000)
  const { db } = await import('@stacksjs/database')
  const claimed: any[] = []

  for (let i = 0; i < limit; i++) {
    // Atomic claim: select + reserve in one step to prevent race conditions
    const job = await db
      .selectFrom('jobs')
      .where('queue', '=', queueName)
      .whereNull('reserved_at')
      .where('available_at', '<=', now)
      .orderBy('id', 'asc')
      .limit(1)
      .selectAll()
      .executeTakeFirst()

    if (!job) break

    // Atomically reserve only if still unreserved (CAS pattern)
    const result = await db
      .updateTable('jobs')
      .set({ reserved_at: now, attempts: ((job as any).attempts || 0) + 1 })
      .where('id', '=', (job as any).id)
      .where('reserved_at', 'is', null)
      .executeTakeFirst()

    const updated = Number((result as any)?.numUpdatedRows ?? 0)
    if (updated > 0) {
      claimed.push(job)
    }
    // If updated === 0, another worker claimed it first; try next
  }

  return claimed
}

/**
 * Process a single job from the database
 */
async function processJob(job: any): Promise<void> {
  const jobId = job.id
  const queueName = job.queue || 'default'
  activeJobCount++
  const startTime = Date.now()

  const { emitQueueEvent, getWorkerTracker } = await import('./events')
  const tracker = getWorkerTracker()
  tracker.markActive(workerId)

  let parsedJobName: string | undefined
  try {
    parsedJobName = JSON.parse(job.payload || '{}').jobName
  }
  catch {
    // Malformed payload — will be caught during execution
  }

  await emitQueueEvent('job:processing', {
    jobId: String(jobId),
    queueName,
    jobName: parsedJobName,
  })

  // Check if this job belongs to a cancelled batch
  try {
    const parsedForBatch = JSON.parse(job.payload || '{}')
    const batchId = parsedForBatch.payload?._batchId
    if (batchId) {
      const { isBatchCancelled } = await import('./batch')
      if (await isBatchCancelled(batchId)) {
        log.info(`[Queue] Skipping job ${jobId} - batch ${batchId} has been cancelled`)
        await deleteJob(jobId)
        activeJobCount--
        tracker.markIdle(workerId)
        return
      }
    }
  }
  catch {
    // Continue processing if batch check fails
  }

  let jobError: Error | null = null

  // Execute the job, enforcing the per-job timeout if declared.
  // The previous code accepted `timeout` on dispatch (`Job.timeout(s)`),
  // stored it in the payload, and then never used it — a runaway
  // handler held the worker forever. (stacksjs/stacks#1872 Q-5.)
  try {
    const payload = JSON.parse(job.payload || '{}')
    const timeoutSec = readJobTimeoutSec(payload)
    if (timeoutSec === undefined) {
      await executeJobPayload(payload)
    }
    else {
      await raceWithTimeout(
        executeJobPayload(payload),
        timeoutSec * 1000,
        `Job ${jobId} exceeded ${timeoutSec}s timeout`,
      )
    }
  }
  catch (e) {
    jobError = e instanceof Error ? e : new Error(String(e))
  }

  // Handle success or failure
  if (!jobError) {
    // Success - delete the job
    try {
      await deleteJob(jobId)
      log.info(`[Queue] Job ${jobId} completed`)
      tracker.recordCompletion(workerId)
      await emitQueueEvent('job:completed', {
        jobId: String(jobId),
        queueName,
        duration: Date.now() - startTime,
      })

      // Track batch completion if this job belongs to a batch
      try {
        const payload = JSON.parse(job.payload || '{}')
        const batchId = payload.payload?._batchId
        if (batchId) {
          const { recordBatchJobCompletion } = await import('./batch')
          await recordBatchJobCompletion(batchId)
        }
      }
      catch {
        // Batch tracking is best-effort
      }
    }
    catch {
      log.info(`[Queue] Failed to delete completed job ${jobId}`)
    }
  }
  else {
    // Failure - retry or move to failed_jobs
    const errorMessage = jobError.message
    log.info(`[Queue] Job ${jobId} failed: ${errorMessage}`)

    tracker.recordFailure(workerId)
    await emitQueueEvent('job:failed', {
      jobId: String(jobId),
      queueName,
      error: jobError,
      duration: Date.now() - startTime,
      attemptsMade: (job.attempts || 0) + 1,
    })

    // Get max attempts from job payload options, default to 1 (no retries)
    let maxAttempts = 1
    let parsedPayload: Record<string, any> = {}
    try {
      parsedPayload = JSON.parse(job.payload || '{}') as Record<string, any>
      maxAttempts = parsedPayload.options?.tries || 1
    }
    catch {
      // Malformed payload — use default max attempts
    }
    const currentAttempts = (job.attempts || 0) + 1

    if (currentAttempts >= maxAttempts) {
      // Move to failed jobs
      log.info(`[Queue] Job ${jobId} exceeded max attempts (${currentAttempts}/${maxAttempts}), moving to failed_jobs`)
      try {
        await moveToFailedJobs(job, jobError)
      }
      catch {
        log.info(`[Queue] Failed to move job ${jobId} to failed_jobs`)
      }
      try {
        await deleteJob(jobId)
      }
      catch {
        log.info(`[Queue] Failed to delete failed job ${jobId}`)
      }

      // Track batch failure if this job belongs to a batch
      try {
        const batchId = parsedPayload.payload?._batchId
        if (batchId) {
          const { recordBatchJobFailure } = await import('./batch')
          await recordBatchJobFailure(batchId, String(jobId), jobError)
        }
      }
      catch {
        // Batch tracking is best-effort
      }
    }
    else {
      // Release for retry with backoff
      const backoffDelays = parsedPayload.options?.backoff
      let retryDelay = 30 // default 30 seconds
      if (Array.isArray(backoffDelays) && backoffDelays.length > 0) {
        // Use the appropriate backoff delay for this attempt (0-indexed)
        const backoffIndex = Math.min(currentAttempts - 1, backoffDelays.length - 1)
        retryDelay = backoffDelays[backoffIndex]
      }
      else if (typeof backoffDelays === 'number' && backoffDelays > 0) {
        retryDelay = backoffDelays
      }

      log.info(`[Queue] Job ${jobId} will be retried in ${retryDelay}s (attempt ${currentAttempts}/${maxAttempts})`)
      try {
        await releaseJob(jobId, retryDelay)
        log.info(`[Queue] Job ${jobId} released for retry`)
      }
      catch {
        log.info(`[Queue] Failed to release job ${jobId} for retry`)
      }
    }
  }

  activeJobCount--
  tracker.markIdle(workerId)
}

/**
 * Delete a job from the queue
 */
async function deleteJob(jobId: number): Promise<void> {
  const { db } = await import('@stacksjs/database')
  await db.deleteFrom('jobs').where('id', '=', jobId).execute()
}

/**
 * Release a job for retry
 */
async function releaseJob(jobId: number, delaySeconds: number = 30): Promise<void> {
  const retryAt = Math.floor(Date.now() / 1000) + delaySeconds
  log.debug(`Releasing job ${jobId} for retry at ${retryAt}`)

  try {
    const { db } = await import('@stacksjs/database')
    await db
      .updateTable('jobs')
      .set({ reserved_at: null, available_at: retryAt })
      .where('id', '=', jobId)
      .execute()
    log.debug(`Job ${jobId} released successfully`)
  }
  catch {
    log.error(`Failed to release job ${jobId}`)
  }
}

/**
 * Move a job to the failed_jobs table
 */
async function moveToFailedJobs(job: any, error: Error): Promise<void> {
  try {
    const failedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const uuid = crypto.randomUUID()
    const exception = error.stack || error.message

    const { db } = await import('@stacksjs/database')
    await db
      .insertInto('failed_jobs')
      .values({
        uuid,
        connection: 'database',
        queue: job.queue,
        payload: job.payload,
        exception,
        failed_at: failedAt,
      })
      .execute()
  }
  catch (insertError) {
    log.error('Failed to log failed job:', insertError)
  }
}

/**
 * Pull the per-job timeout (in seconds) out of the queued payload.
 * Returns undefined when not set — callers branch on that to skip the
 * timeout race for the common no-timeout case.
 *
 * Looks at `payload.options.timeout` (the shape `Job.dispatch()` writes
 * via `dispatchToDatabase()`); silently tolerates malformed input
 * because the worker should never crash on a missing field — the next
 * `executeJobPayload` will surface the real error.
 */
function readJobTimeoutSec(payload: unknown): number | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const opts = (payload as { options?: { timeout?: unknown } }).options
  const t = opts?.timeout
  if (typeof t !== 'number' || !Number.isFinite(t) || t <= 0) return undefined
  return t
}

/**
 * Race `task` against a setTimeout. If the timer wins, throw an Error
 * with the supplied message so the standard retry-or-fail-jobs machinery
 * treats it like any other handler failure. (stacksjs/stacks#1872 Q-5.)
 *
 * NOTE: there is no way to cancel an in-flight Promise from outside
 * JavaScript — the underlying work keeps running in the background
 * until it settles. The job IS treated as failed (and may be retried
 * or moved to failed_jobs), but a buggy handler that holds a database
 * connection forever still holds it. Documented in `Job.timeout()`.
 */
async function raceWithTimeout<T>(task: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  try {
    return await Promise.race([task, timeout])
  }
  finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/**
 * Job-dispatch envelope. The shape `Job.dispatch()` / `JobAction.dispatch()`
 * write to the database (`{ jobName, payload, options }`) and to Redis
 * (`{ jobName, payload }`), plus the legacy Laravel-import shape
 * (`{ job: 'App\\Jobs\\Foo', data: … }`).
 *
 * Typed at the worker boundary so the previous `payload: any` couldn't
 * silently leak typos like `payload.payload?.id` reading off undefined
 * properties without a TS hint. (stacksjs/stacks#1872 Q-9.)
 */
/**
 * Execute a queued job payload. Accepts `unknown` and routes through
 * the shared {@link parseEnvelope} (stacksjs/stacks#1884 Q-6) so the
 * database and redis read paths use exactly the same deserializer.
 *
 * Three envelope shapes are accepted:
 *   - **v1** — current shape, written by `createEnvelope`
 *   - **v0 implicit** — pre-#1884 `{ jobName, payload, options? }`
 *   - **Laravel legacy** — `{ job: 'App\\Jobs\\Foo', data }`
 *
 * An unknown-but-newer `envelopeVersion` returns an "unknown-version"
 * error rather than processing — lets a rolling deploy with newer
 * envelopes coexist with older workers that leave those rows for the
 * newer build.
 *
 * Originally added under stacksjs/stacks#1872 Q-9 (payload validation
 * at the worker boundary). The branching shape lived inline; the
 * envelope module is the canonical place now.
 */
async function executeJobPayload(payload: unknown): Promise<void> {
  const parsed = parseEnvelope(payload)
  if (!parsed.ok) {
    throw new Error(
      `[queue] Cannot deserialize job envelope: ${parsed.reason}`
      + (parsed.detail ? ` (${parsed.detail})` : ''),
    )
  }
  const { runJob } = await import('./job')
  await runJob(parsed.envelope.jobName, { payload: parsed.envelope.payload })
}

/**
 * Process jobs from Redis using bun-queue's worker
 */
async function processJobsFromRedis(queueName: string, concurrency: number): Promise<void> {
  const { RedisQueue } = await import('./drivers/redis')
  const { queue: queueConfig } = await import('@stacksjs/config')
  // `queueConfig` is typed end-to-end as `StacksOptions['queue']`
  // (stacksjs/stacks#1875 T-6) — the previous `as any` casts on the
  // config read AND the RedisQueue constructor arg silently escaped
  // that typing.
  const redisConfig = queueConfig?.connections?.redis

  if (!redisConfig) {
    throw new Error('Redis queue connection is not configured. Check config/queue.ts')
  }

  const queue = new RedisQueue(queueName, redisConfig)

  const { emitQueueEvent, getWorkerTracker } = await import('./events')
  const tracker = getWorkerTracker()

  queue.process(concurrency, async (bunJob: any) => {
    activeJobCount++
    tracker.markActive(workerId)
    const startTime = Date.now()
    // Parse the bun-queue data shape through the same envelope
    // parser the database driver uses (stacksjs/stacks#1884 Q-6).
    // A worker reading redis jobs queued under the old shape (or
    // database jobs migrated by an external tool into redis) will
    // hit the parser's v0-implicit fallback rather than silently
    // dropping the job because of a shape mismatch.
    const parsed = parseEnvelope(bunJob.data)
    if (!parsed.ok) {
      activeJobCount--
      tracker.markIdle(workerId)
      log.error(`[Queue] Skipping Redis job ${bunJob.id} - unparseable envelope: ${parsed.reason}${parsed.detail ? ` (${parsed.detail})` : ''}`)
      return
    }
    const data = parsed.envelope

    // Check if this job belongs to a cancelled batch. `_batchId` is
    // carried on the inner payload by the batch dispatcher.
    const batchId = (data.payload as { _batchId?: string } | undefined)?._batchId
    if (batchId) {
      try {
        const { isBatchCancelled } = await import('./batch')
        if (await isBatchCancelled(batchId)) {
          log.info(`[Queue] Skipping Redis job ${bunJob.id} - batch ${batchId} has been cancelled`)
          activeJobCount--
          tracker.markIdle(workerId)
          return
        }
      }
      catch {
        // Continue processing if batch check fails
      }
    }

    await emitQueueEvent('job:processing', {
      jobId: String(bunJob.id),
      queueName,
    })

    try {
      const { runJob } = await import('./job')
      await runJob(data.jobName, { payload: data.payload })

      tracker.recordCompletion(workerId)
      await emitQueueEvent('job:completed', {
        jobId: String(bunJob.id),
        queueName,
        duration: Date.now() - startTime,
      })

      // Track batch completion
      if (batchId) {
        try {
          const { recordBatchJobCompletion } = await import('./batch')
          await recordBatchJobCompletion(batchId)
        }
        catch {
          // Batch tracking is best-effort
        }
      }

      log.info(`[Queue] Redis job ${bunJob.id} completed`)
    }
    catch (e) {
      tracker.recordFailure(workerId)
      await emitQueueEvent('job:failed', {
        jobId: String(bunJob.id),
        queueName,
        error: e instanceof Error ? e : new Error(String(e)),
        duration: Date.now() - startTime,
      })

      // Track batch failure
      if (batchId) {
        try {
          const { recordBatchJobFailure } = await import('./batch')
          await recordBatchJobFailure(batchId, String(bunJob.id), e instanceof Error ? e : new Error(String(e)))
        }
        catch {
          // Batch tracking is best-effort
        }
      }

      log.error(`[Queue] Redis job ${bunJob.id} failed: ${e}`)
      // Don't retry "user input was bad" errors — validation failures, 4xx
      // responses, and HttpErrors with 4xx status are deterministic: the
      // exact same payload will fail the exact same way next time. Marking
      // them retryable just burns the retry budget and floods failed_jobs.
      if (isNonRetryableError(e)) {
        log.info(`[Queue] Redis job ${bunJob.id} hit a non-retryable error — skipping retry`)
        return // resolve without throw → bun-queue treats job as completed-with-error
      }
      throw e // Let bun-queue handle retries
    }
    finally {
      activeJobCount--
      tracker.markIdle(workerId)
    }
  })

  log.info(`Listening for Redis jobs on queue "${queueName}" with concurrency ${concurrency}...`)

  // Keep the worker alive
  while (workerRunning) {
    await sleep(1000)
  }

  await queue.close()
}

/**
 * Stop the queue processor, draining in-flight jobs within a grace
 * window before returning. The `signalled to stop` flag stops the
 * polling loop from claiming new jobs; any handler that's currently
 * mid-execution gets up to `graceMs` to finish.
 *
 * `graceMs` defaults to 10s (matches the buddy CLI's existing
 * SIGTERM → SIGKILL window). Pass 0 to skip the wait entirely
 * (test runs, CI).
 *
 * When the grace window expires with jobs still active, the function
 * resolves anyway — the reservation-sweep (Q-2) will requeue them on
 * the next worker startup. The alternative (hanging the process
 * forever) is worse than the requeue cost.
 *
 * See stacksjs/stacks#1872 Q-10.
 */
export async function stopProcessor(options: { graceMs?: number } = {}): Promise<void> {
  const graceMs = options.graceMs ?? 10_000
  workerRunning = false

  if (inFlightJobs.size > 0 && graceMs > 0) {
    log.info(`[queue] Draining ${inFlightJobs.size} in-flight job(s) (grace ${graceMs}ms)`)
    const drain = Promise.allSettled([...inFlightJobs])
    const timeout = new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), graceMs))
    const outcome = await Promise.race([drain.then(() => 'drained' as const), timeout])
    if (outcome === 'timeout' && inFlightJobs.size > 0) {
      log.warn(
        `[queue] Drain timed out with ${inFlightJobs.size} job(s) still active. `
        + `Their reservations will be reclaimed by the next worker's sweep (Q-2).`,
      )
    }
  }

  if (workerId) {
    const { getWorkerTracker } = await import('./events')
    getWorkerTracker().unregister(workerId)
  }
  log.info('Queue processor stopped')
}

/**
 * Retry all failed jobs
 */
export async function executeFailedJobs(): Promise<void> {
  const { db } = await import('@stacksjs/database')
  const failedJobs = await db
    .selectFrom('failed_jobs')
    .selectAll()
    .execute()

  for (const failedJob of failedJobs as any[]) {
    await retryFailedJob(Number(failedJob.id))
  }
}

/**
 * Retry a specific failed job
 */
export async function retryFailedJob(id: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ')

  const { db } = await import('@stacksjs/database')

  const failedJobs = await db
    .selectFrom('failed_jobs')
    .where('id', '=', id)
    .selectAll()
    .execute()

  const failedJob = (failedJobs as any[])[0]

  if (!failedJob) {
    throw new Error(`Failed job ${id} not found`)
  }

  // Re-queue the job
  await db
    .insertInto('jobs')
    .values({
      queue: failedJob.queue,
      payload: failedJob.payload,
      attempts: 0,
      reserved_at: null,
      available_at: now,
      created_at: createdAt,
    })
    .execute()

  // Remove from failed jobs
  await db
    .deleteFrom('failed_jobs')
    .where('id', '=', id)
    .execute()

  log.info(`Failed job ${id} has been re-queued`)
}

/**
 * Get the count of currently active (processing) jobs
 */
export function getActiveJobCount(): number {
  return activeJobCount
}

/**
 * Check if the worker is currently running
 */
export function isWorkerRunning(): boolean {
  return workerRunning
}

/**
 * Helper: sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
