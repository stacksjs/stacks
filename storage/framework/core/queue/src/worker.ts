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
    const results = await db.rawQuery('SELECT DISTINCT queue FROM jobs')
    const queues = (results as any[]).map((r: any) => r.queue).filter(Boolean)
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
            await processJob(job)
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

  // Execute the job
  try {
    const payload = JSON.parse(job.payload || '{}')
    await executeJobPayload(payload)
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
 * Execute the job payload
 */
async function executeJobPayload(payload: any): Promise<void> {
  // Check if this is a Stacks job (from app/Jobs)
  if (payload.job && payload.job.startsWith('App\\Jobs\\')) {
    const jobName = payload.job.replace('App\\Jobs\\', '')
    const { runJob } = await import('./job')
    await runJob(jobName, { payload: payload.data })
  }
  else if (payload.jobName) {
    // Handle jobs dispatched via job() helper
    const { runJob } = await import('./job')
    await runJob(payload.jobName, { payload: payload.payload })
  }
  // Generic job - nothing to do
}

/**
 * Process jobs from Redis using bun-queue's worker
 */
async function processJobsFromRedis(queueName: string, concurrency: number): Promise<void> {
  const { RedisQueue } = await import('./drivers/redis')
  const { queue: queueConfig } = await import('@stacksjs/config')
  const redisConfig = (queueConfig as any)?.connections?.redis

  if (!redisConfig) {
    throw new Error('Redis queue connection is not configured. Check config/queue.ts')
  }

  const queue = new RedisQueue(queueName, redisConfig as any)

  const { emitQueueEvent, getWorkerTracker } = await import('./events')
  const tracker = getWorkerTracker()

  queue.process(concurrency, async (bunJob: any) => {
    activeJobCount++
    tracker.markActive(workerId)
    const startTime = Date.now()
    const data = bunJob.data

    // Check if this job belongs to a cancelled batch
    const batchId = data?.payload?._batchId
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
      if (data?.jobName) {
        const { runJob } = await import('./job')
        await runJob(data.jobName, { payload: data.payload })
      }
      else if (data?.job && data.job.startsWith?.('App\\Jobs\\')) {
        const jobName = data.job.replace('App\\Jobs\\', '')
        const { runJob } = await import('./job')
        await runJob(jobName, { payload: data.data })
      }

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
 * Stop the queue processor
 */
export async function stopProcessor(): Promise<void> {
  workerRunning = false
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
