/**
 * Queue Worker Functions
 *
 * Functions for managing queue workers and processing jobs.
 * Uses the configured database driver to store and process jobs.
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

/**
 * Get the database driver from environment
 */
function getDriver(): string {
  return envVars.DB_CONNECTION || 'sqlite'
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
    const concurrency = options.concurrency || 1

    // If no queue specified, get all unique queues from the database
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

    // Use database-backed job processing
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

  const driver = getDriver()
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
          jobs = await fetchPendingJobs(queueName, concurrency, driver)
        }
        catch {
          // Ignore fetch errors, will retry next cycle
          continue
        }

        for (const job of jobs) {
          try {
            log.info(`Processing job ${job.id} from queue "${queueName}"`)
            await processJob(job, driver)
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
async function fetchPendingJobs(queueName: string, limit: number, _driver: string): Promise<any[]> {
  const now = Math.floor(Date.now() / 1000)

  const { db } = await import('@stacksjs/database')

  return await db
    .selectFrom('jobs')
    .where('queue', '=', queueName)
    .whereNull('reserved_at')
    .where('available_at', '<=', now)
    .orderBy('id', 'asc')
    .limit(limit)
    .selectAll()
    .execute()
}

/**
 * Process a single job from the database
 */
async function processJob(job: any, _driver: string): Promise<void> {
  const jobId = job.id
  activeJobCount++

  let jobError: Error | null = null

  // Step 1: Reserve the job
  try {
    await reserveJob(jobId, job.attempts || 0)
  }
  catch (e) {
    log.error(`Failed to reserve job ${jobId}`)
    activeJobCount--
    return
  }

  // Step 2: Execute the job
  try {
    const payload = JSON.parse(job.payload || '{}')
    await executeJobPayload(payload)
  }
  catch (e) {
    jobError = e instanceof Error ? e : new Error(String(e))
  }

  // Step 3: Handle success or failure
  if (!jobError) {
    // Success - delete the job
    try {
      await deleteJob(jobId)
      console.log(`[Queue] Job ${jobId} completed`)
    }
    catch {
      console.log(`[Queue] Failed to delete completed job ${jobId}`)
    }
  }
  else {
    // Failure - retry or move to failed_jobs
    const errorMessage = jobError.message
    console.log(`[Queue] Job ${jobId} failed: ${errorMessage}`)

    // Get max attempts from job payload options, default to 1 (no retries)
    const payload = JSON.parse(job.payload || '{}')
    const maxAttempts = payload.options?.tries || 1
    const currentAttempts = (job.attempts || 0) + 1

    if (currentAttempts >= maxAttempts) {
      // Move to failed jobs
      console.log(`[Queue] Job ${jobId} exceeded max attempts (${currentAttempts}/${maxAttempts}), moving to failed_jobs`)
      try {
        await moveToFailedJobs(job, jobError)
      }
      catch {
        console.log(`[Queue] Failed to move job ${jobId} to failed_jobs`)
      }
      try {
        await deleteJob(jobId)
      }
      catch {
        console.log(`[Queue] Failed to delete failed job ${jobId}`)
      }
    }
    else {
      // Release for retry
      console.log(`[Queue] Job ${jobId} will be retried (attempt ${currentAttempts}/${maxAttempts})`)
      try {
        await releaseJob(jobId)
        console.log(`[Queue] Job ${jobId} released for retry`)
      }
      catch {
        console.log(`[Queue] Failed to release job ${jobId} for retry`)
      }
    }
  }

  activeJobCount--
}

/**
 * Reserve a job (mark it as being processed)
 */
async function reserveJob(jobId: number, attempts: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000)

  const { db } = await import('@stacksjs/database')
  await db
    .updateTable('jobs')
    .set({ reserved_at: now, attempts: attempts + 1 })
    .where('id', '=', jobId)
    .execute()
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
async function releaseJob(jobId: number): Promise<void> {
  const retryAt = Math.floor(Date.now() / 1000) + 30 // Retry in 30 seconds
  log.debug(`Releasing job ${jobId} for retry at ${retryAt}`)

  try {
    const { db } = await import('@stacksjs/database')
    await db.rawQuery(`UPDATE jobs SET reserved_at = NULL, available_at = ${retryAt} WHERE id = ${jobId}`)
    log.debug(`Job ${jobId} released successfully`)
  }
  catch {
    log.error(`Failed to release job ${jobId}`)
    // Don't throw - just log the error
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
 * Stop the queue processor
 */
export async function stopProcessor(): Promise<void> {
  workerRunning = false
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
