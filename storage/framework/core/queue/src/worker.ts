/**
 * Queue Worker Functions
 *
 * Functions for managing queue workers and processing jobs.
 * These integrate bun-queue's WorkerManager with Stacks conventions.
 */

import type { Result } from '@stacksjs/error-handling'
import type { WorkerOptions } from 'bun-queue'
import { err, ok } from '@stacksjs/error-handling'
import { db } from '@stacksjs/database'
import { log } from '@stacksjs/logging'
import { config } from '@stacksjs/config'
import { QueueWorker, WorkerManager } from 'bun-queue'

// Global worker manager instance
let workerManager: WorkerManager | null = null
let activeJobCount = 0
let workerRunning = false

/**
 * Get the worker manager singleton
 */
function getWorkerManager(): WorkerManager {
  if (!workerManager) {
    const queueConfig = {
      default: config.queue?.default || 'database',
      connections: {
        database: {
          driver: 'database' as const,
          table: 'jobs',
          queue: 'default',
          retry_after: 90,
        },
      },
      failed: {
        driver: 'database' as const,
        table: 'failed_jobs',
      },
    }
    workerManager = new WorkerManager(queueConfig as any)
  }
  return workerManager
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
    const queues = queueName ? [queueName] : ['default']

    // Use database-backed job processing for Stacks
    await processJobsFromDatabase(queues, concurrency)

    return ok(undefined)
  }
  catch (error) {
    workerRunning = false
    return err(error as Error)
  }
}

/**
 * Process jobs from the database (jobs table)
 * This is the main processing loop for database-backed queues
 */
async function processJobsFromDatabase(queues: string[], concurrency: number): Promise<void> {
  log.info(`Processing jobs from queues: ${queues.join(', ')} with concurrency ${concurrency}`)

  while (workerRunning) {
    try {
      // Get pending jobs from database
      for (const queueName of queues) {
        const jobs = await db
          .selectFrom('jobs')
          .where('queue', '=', queueName)
          .where((eb) =>
            eb.or([
              eb('reserved_at', 'is', null),
              eb('reserved_at', '<', Math.floor(Date.now() / 1000) - 90), // Retry after 90 seconds
            ]),
          )
          .where((eb) =>
            eb.or([
              eb('available_at', 'is', null),
              eb('available_at', '<=', Math.floor(Date.now() / 1000)),
            ]),
          )
          .orderBy('id', 'asc')
          .limit(concurrency)
          .selectAll()
          .execute()

        for (const job of jobs) {
          await processJob(job)
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
 * Process a single job from the database
 */
async function processJob(job: any): Promise<void> {
  const jobId = job.id

  try {
    activeJobCount++

    // Reserve the job
    await db
      .updateTable('jobs')
      .set({
        reserved_at: Math.floor(Date.now() / 1000),
        attempts: (job.attempts || 0) + 1,
      })
      .where('id', '=', jobId)
      .execute()

    log.debug(`Processing job ${jobId} from queue ${job.queue}`)

    // Parse and execute the job
    const payload = JSON.parse(job.payload || '{}')
    await executeJobPayload(payload)

    // Delete job on success
    await db
      .deleteFrom('jobs')
      .where('id', '=', jobId)
      .execute()

    log.debug(`Job ${jobId} completed successfully`)
  }
  catch (error) {
    log.error(`Job ${jobId} failed:`, error)

    // Check if we should retry
    const maxAttempts = 3
    if ((job.attempts || 0) + 1 >= maxAttempts) {
      // Move to failed jobs
      await moveToFailedJobs(job, error as Error)

      // Delete from jobs table
      await db
        .deleteFrom('jobs')
        .where('id', '=', jobId)
        .execute()
    }
    else {
      // Release the job for retry
      await db
        .updateTable('jobs')
        .set({
          reserved_at: null,
          available_at: Math.floor(Date.now() / 1000) + 60, // Retry in 60 seconds
        })
        .where('id', '=', jobId)
        .execute()
    }
  }
  finally {
    activeJobCount--
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
 * Move a job to the failed_jobs table
 */
async function moveToFailedJobs(job: any, error: Error): Promise<void> {
  try {
    await db
      .insertInto('failed_jobs')
      .values({
        uuid: crypto.randomUUID(),
        connection: job.connection || 'database',
        queue: job.queue,
        payload: job.payload,
        exception: error.stack || error.message,
        failed_at: new Date().toISOString(),
      })
      .execute()
  }
  catch (insertError) {
    log.error('Failed to log failed job:', insertError)
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
  const failedJobs = await db
    .selectFrom('failed_jobs')
    .selectAll()
    .execute()

  for (const failedJob of failedJobs) {
    await retryFailedJob(Number(failedJob.id))
  }
}

/**
 * Retry a specific failed job
 */
export async function retryFailedJob(id: number): Promise<void> {
  const failedJob = await db
    .selectFrom('failed_jobs')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

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
      available_at: Math.floor(Date.now() / 1000),
      created_at: new Date().toISOString(),
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
