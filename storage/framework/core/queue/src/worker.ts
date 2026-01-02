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

// Environment variables
const envVars = typeof Bun !== 'undefined' ? Bun.env : process.env

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
): Promise<Result<void, Error>> {
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
        const refreshedQueues = await getAllQueues()
        if (refreshedQueues.length > 0) {
          queues = refreshedQueues
        }
        lastQueueRefresh = now
      }

      for (const queueName of queues) {
        const jobs = await fetchPendingJobs(queueName, concurrency, driver)

        for (const job of jobs) {
          log.info(`Processing job ${job.id} from queue "${queueName}"`)
          await processJob(job, driver)
        }
      }

      // Sleep between polling cycles
      await sleep(1000)
    }
    catch (error) {
      log.error('Error processing jobs:', error)
      await sleep(3000)
    }
  }
}

/**
 * Fetch pending jobs from the database
 */
async function fetchPendingJobs(queueName: string, limit: number, driver: string): Promise<any[]> {
  const now = Math.floor(Date.now() / 1000)
  const retryAfter = now - 90 // Jobs reserved more than 90 seconds ago can be retried

  const { db } = await import('@stacksjs/database')

  return await db
    .selectFrom('jobs')
    .where('queue', '=', queueName)
    .where(['reserved_at', 'is', null])
    .where(['available_at', '<=', now])
    .orderBy('id', 'asc')
    .limit(limit)
    .selectAll()
    .execute()
}

/**
 * Process a single job from the database
 */
async function processJob(job: any, driver: string): Promise<void> {
  const jobId = job.id

  try {
    activeJobCount++

    // Reserve the job
    await reserveJob(jobId, job.attempts || 0)

    // Parse and execute the job
    const payload = JSON.parse(job.payload || '{}')
    await executeJobPayload(payload)

    // Delete job on success
    await deleteJob(jobId)

    log.info(`Job ${jobId} completed`)
  }
  catch (error) {
    log.error(`Job ${jobId} failed:`, error)

    // Check if we should retry
    const maxAttempts = 3
    if ((job.attempts || 0) + 1 >= maxAttempts) {
      // Move to failed jobs
      await moveToFailedJobs(job, error as Error)
      await deleteJob(jobId)
    }
    else {
      // Release the job for retry
      await releaseJob(jobId)
    }
  }
  finally {
    activeJobCount--
  }
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
  const retryAt = Math.floor(Date.now() / 1000) + 60 // Retry in 60 seconds

  const { db } = await import('@stacksjs/database')
  await db
    .updateTable('jobs')
    .set({ reserved_at: null, available_at: retryAt })
    .where('id', '=', jobId)
    .execute()
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
  else {
    // Generic job - just log it
    log.debug('Processing generic job payload:', payload)
  }
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
