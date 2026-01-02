/**
 * Queue Worker Functions
 *
 * Functions for managing queue workers and processing jobs.
 * Uses the database driver to store and process jobs.
 */

import type { Result } from '@stacksjs/error-handling'
import { err, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import Database from 'bun:sqlite'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
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
 * Get the SQLite database path
 */
function getDatabasePath(): string {
  const appRoot = envVars.APP_ROOT || process.cwd()
  return join(appRoot, 'database', 'stacks.sqlite')
}

/**
 * Get a SQLite database connection
 */
function getDatabase(): Database {
  const dbPath = getDatabasePath()
  if (!existsSync(dbPath)) {
    throw new Error(`Database file not found: ${dbPath}`)
  }
  return new Database(dbPath)
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
 * Process jobs from the database (jobs table)
 * This is the main processing loop for database-backed queues
 */
async function processJobsFromDatabase(queues: string[], concurrency: number): Promise<void> {
  log.info(`Processing jobs from queues: ${queues.join(', ')} with concurrency ${concurrency}`)

  const driver = getDriver()

  while (workerRunning) {
    try {
      for (const queueName of queues) {
        const jobs = await fetchPendingJobs(queueName, concurrency, driver)

        for (const job of jobs) {
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

  // Use SQLite directly if available
  const sqlitePath = getDatabasePath()
  if (driver === 'sqlite' || existsSync(sqlitePath)) {
    const db = getDatabase()
    try {
      const jobs = db.query(`
        SELECT * FROM jobs
        WHERE queue = ?
        AND (reserved_at IS NULL OR reserved_at < ?)
        AND (available_at IS NULL OR available_at <= ?)
        ORDER BY id ASC
        LIMIT ?
      `).all(queueName, retryAfter, now, limit)
      return jobs as any[]
    }
    finally {
      db.close()
    }
  }

  // Fallback to query builder for other drivers
  const { db } = await import('@stacksjs/database')
  return await db
    .selectFrom('jobs')
    .where('queue', '=', queueName)
    .where((eb: any) =>
      eb.or([
        eb('reserved_at', 'is', null),
        eb('reserved_at', '<', retryAfter),
      ]),
    )
    .where((eb: any) =>
      eb.or([
        eb('available_at', 'is', null),
        eb('available_at', '<=', now),
      ]),
    )
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
    await reserveJob(jobId, job.attempts || 0, driver)

    log.debug(`Processing job ${jobId} from queue ${job.queue}`)

    // Parse and execute the job
    const payload = JSON.parse(job.payload || '{}')
    await executeJobPayload(payload)

    // Delete job on success
    await deleteJob(jobId, driver)

    log.debug(`Job ${jobId} completed successfully`)
  }
  catch (error) {
    log.error(`Job ${jobId} failed:`, error)

    // Check if we should retry
    const maxAttempts = 3
    if ((job.attempts || 0) + 1 >= maxAttempts) {
      // Move to failed jobs
      await moveToFailedJobs(job, error as Error, driver)
      await deleteJob(jobId, driver)
    }
    else {
      // Release the job for retry
      await releaseJob(jobId, driver)
    }
  }
  finally {
    activeJobCount--
  }
}

/**
 * Reserve a job (mark it as being processed)
 */
async function reserveJob(jobId: number, attempts: number, driver: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)

  const sqlitePath = getDatabasePath()
  if (driver === 'sqlite' || existsSync(sqlitePath)) {
    const db = getDatabase()
    try {
      db.run('UPDATE jobs SET reserved_at = ?, attempts = ? WHERE id = ?', [now, attempts + 1, jobId])
    }
    finally {
      db.close()
    }
    return
  }

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
async function deleteJob(jobId: number, driver: string): Promise<void> {
  const sqlitePath = getDatabasePath()
  if (driver === 'sqlite' || existsSync(sqlitePath)) {
    const db = getDatabase()
    try {
      db.run('DELETE FROM jobs WHERE id = ?', [jobId])
    }
    finally {
      db.close()
    }
    return
  }

  const { db } = await import('@stacksjs/database')
  await db.deleteFrom('jobs').where('id', '=', jobId).execute()
}

/**
 * Release a job for retry
 */
async function releaseJob(jobId: number, driver: string): Promise<void> {
  const retryAt = Math.floor(Date.now() / 1000) + 60 // Retry in 60 seconds

  const sqlitePath = getDatabasePath()
  if (driver === 'sqlite' || existsSync(sqlitePath)) {
    const db = getDatabase()
    try {
      db.run('UPDATE jobs SET reserved_at = NULL, available_at = ? WHERE id = ?', [retryAt, jobId])
    }
    finally {
      db.close()
    }
    return
  }

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
async function moveToFailedJobs(job: any, error: Error, driver: string): Promise<void> {
  const sqlitePath = getDatabasePath()
  if (driver === 'sqlite' || existsSync(sqlitePath)) {
    const db = getDatabase()
    try {
      db.run(`
        INSERT INTO failed_jobs (uuid, connection, queue, payload, exception, failed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        crypto.randomUUID(),
        'database',
        job.queue,
        job.payload,
        error.stack || error.message,
        new Date().toISOString(),
      ])
    }
    catch (insertError) {
      log.error('Failed to log failed job:', insertError)
    }
    finally {
      db.close()
    }
    return
  }

  try {
    const { db } = await import('@stacksjs/database')
    await db
      .insertInto('failed_jobs')
      .values({
        uuid: crypto.randomUUID(),
        connection: 'database',
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
  const driver = getDriver()
  const sqlitePath = getDatabasePath()

  let failedJobs: any[]

  if (driver === 'sqlite' || existsSync(sqlitePath)) {
    const db = getDatabase()
    try {
      failedJobs = db.query('SELECT * FROM failed_jobs').all() as any[]
    }
    finally {
      db.close()
    }
  }
  else {
    const { db } = await import('@stacksjs/database')
    failedJobs = await db.selectFrom('failed_jobs').selectAll().execute()
  }

  for (const failedJob of failedJobs) {
    await retryFailedJob(Number(failedJob.id))
  }
}

/**
 * Retry a specific failed job
 */
export async function retryFailedJob(id: number): Promise<void> {
  const driver = getDriver()
  const sqlitePath = getDatabasePath()
  const now = Math.floor(Date.now() / 1000)

  if (driver === 'sqlite' || existsSync(sqlitePath)) {
    const db = getDatabase()
    try {
      const failedJob = db.query('SELECT * FROM failed_jobs WHERE id = ?').get(id) as any

      if (!failedJob) {
        throw new Error(`Failed job ${id} not found`)
      }

      // Re-queue the job
      db.run(`
        INSERT INTO jobs (queue, payload, attempts, reserved_at, available_at, created_at)
        VALUES (?, ?, 0, NULL, ?, datetime('now'))
      `, [failedJob.queue, failedJob.payload, now])

      // Remove from failed jobs
      db.run('DELETE FROM failed_jobs WHERE id = ?', [id])

      log.info(`Failed job ${id} has been re-queued`)
    }
    finally {
      db.close()
    }
    return
  }

  const { db } = await import('@stacksjs/database')

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
      available_at: now,
      created_at: new Date().toISOString(),
    })
    .execute()

  // Remove from failed jobs
  await db.deleteFrom('failed_jobs').where('id', '=', id).execute()

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
