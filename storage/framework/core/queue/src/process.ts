import type { Ok } from '@stacksjs/error-handling'
import type { JobModel, JobsModel } from '@stacksjs/orm'
import type { JitterConfig, JobOptions } from '@stacksjs/types'
import { ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/orm'
import { FailedJob } from '../../../orm/src/models/FailedJob'
import { emitQueueEvent } from './events'
import { runJob } from './job'
import { notifyJobFailed } from './notifications'

interface QueuePayload {
  path: string
  name: string
  maxTries: number
  timeOut: number | null
  timeOutAt: Date | null
  params: any
  classPayload: string
}

interface WorkerState {
  isRunning: boolean
  isShuttingDown: boolean
  activeJobs: Set<number>
  stalledCheckInterval: ReturnType<typeof setInterval> | null
  processInterval: ReturnType<typeof setTimeout> | null
}

// Worker state management
const workerState: WorkerState = {
  isRunning: false,
  isShuttingDown: false,
  activeJobs: new Set(),
  stalledCheckInterval: null,
  processInterval: null,
}

// Stalled job configuration
const STALLED_JOB_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes
const STALLED_CHECK_INTERVAL_MS = 60 * 1000 // Check every minute

/**
 * Start the job processor with graceful shutdown support
 */
export async function processJobs(queue: string | undefined): Promise<Ok<string, never>> {
  if (workerState.isRunning) {
    return ok('Job processor is already running')
  }

  workerState.isRunning = true
  workerState.isShuttingDown = false

  // Setup graceful shutdown handlers
  setupGracefulShutdown()

  // Start stalled job detection
  startStalledJobDetection(queue)

  // Emit worker started event
  await emitQueueEvent('worker:started', {
    queueName: queue || 'all',
  })

  log.info(`Queue worker started${queue ? ` for queue: ${queue}` : ''}`)

  async function process() {
    if (workerState.isShuttingDown) {
      return
    }

    await executeJobs(queue)

    if (!workerState.isShuttingDown) {
      workerState.processInterval = setTimeout(process, 1000)
    }
  }

  process()

  return ok('Job processing has started successfully!')
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    if (workerState.isShuttingDown) {
      return
    }

    log.info(`Received ${signal}, initiating graceful shutdown...`)
    workerState.isShuttingDown = true

    // Clear intervals
    if (workerState.stalledCheckInterval) {
      clearInterval(workerState.stalledCheckInterval)
      workerState.stalledCheckInterval = null
    }

    if (workerState.processInterval) {
      clearTimeout(workerState.processInterval)
      workerState.processInterval = null
    }

    // Wait for active jobs to complete (with timeout)
    const shutdownTimeout = 30000 // 30 seconds
    const startTime = Date.now()

    while (workerState.activeJobs.size > 0 && Date.now() - startTime < shutdownTimeout) {
      log.info(`Waiting for ${workerState.activeJobs.size} active job(s) to complete...`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    if (workerState.activeJobs.size > 0) {
      log.warn(`Shutdown timeout reached with ${workerState.activeJobs.size} jobs still running`)
    }

    // Emit worker stopped event
    await emitQueueEvent('worker:stopped', {
      queueName: 'all',
    })

    workerState.isRunning = false
    log.info('Queue worker stopped gracefully')
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

/**
 * Start stalled job detection
 */
function startStalledJobDetection(queue: string | undefined): void {
  workerState.stalledCheckInterval = setInterval(async () => {
    if (workerState.isShuttingDown) {
      return
    }

    try {
      await detectAndHandleStalledJobs(queue)
    }
    catch (error) {
      log.error('Error detecting stalled jobs:', error)
    }
  }, STALLED_CHECK_INTERVAL_MS)
}

/**
 * Detect and handle stalled jobs
 */
async function detectAndHandleStalledJobs(queue: string | undefined): Promise<void> {
  const now = timestampNow()
  const stalledThreshold = now - Math.floor(STALLED_JOB_THRESHOLD_MS / 1000)

  // Find jobs that have been reserved (have attempts > 0) but haven't been updated
  const jobs = await Job.when(queue !== undefined, (q: JobModel) => q.where('queue', queue)).get()

  for (const job of jobs) {
    if (!job.payload || !job.reserved_at) {
      continue
    }

    // Check if job is stalled (reserved but not processed for too long)
    if (job.reserved_at < stalledThreshold && job.attempts && job.attempts > 0) {
      log.warn(`Detected stalled job: ${job.id} on queue ${job.queue}`)

      // Emit stalled event
      await emitQueueEvent('job:stalled', {
        jobId: String(job.id),
        queueName: job.queue,
        attemptsMade: job.attempts,
      })

      // Release the job back to the queue
      await job.update({
        reserved_at: null,
        available_at: now,
      })

      log.info(`Released stalled job ${job.id} back to queue`)
    }
  }
}

/**
 * Execute all failed jobs (retry)
 */
export async function executeFailedJobs(): Promise<void> {
  const failedJobs = await FailedJob.all()

  for (const job of failedJobs) {
    if (!job.payload)
      continue

    const body: QueuePayload = JSON.parse(job.payload)
    const classPayload = JSON.parse(body.classPayload) as JobOptions
    const maxTries = Number(classPayload.tries || 3)

    log.info(`Retrying job: ${body.path}`)

    await runJob(body.name, {
      queue: job.queue,
      payload: body.params,
      context: '',
      maxTries,
      timeout: 60,
    })

    await job.delete()
    log.info(`Successfully ran job: ${body.path}`)
  }
}

/**
 * Retry a specific failed job
 */
export async function retryFailedJob(id: number): Promise<void> {
  const failedJob = await FailedJob.find(id)

  if (failedJob && failedJob.payload) {
    const body: QueuePayload = JSON.parse(failedJob.payload)
    const jobPayload = JSON.parse(failedJob.payload) as QueuePayload
    const classPayload = JSON.parse(jobPayload.classPayload) as JobOptions
    const maxTries = Number(classPayload.tries || 3)

    log.info(`Retrying job: ${body.path}`)

    await runJob(body.name, {
      queue: failedJob.queue,
      payload: body.params,
      context: '',
      maxTries,
      timeout: 60,
    })

    await failedJob.delete()
    log.info(`Successfully ran job: ${body.path}`)
  }
}

/**
 * Execute pending jobs from the queue
 */
async function executeJobs(queue: string | undefined): Promise<void> {
  const jobs = await Job.when(queue !== undefined, (query: JobModel) => query.where('queue', queue)).get()

  for (const job of jobs) {
    if (workerState.isShuttingDown) {
      break
    }

    let currentAttempts = job.attempts || 1

    if (!job.payload)
      continue

    if (job.available_at && job.available_at > timestampNow())
      continue

    const body: QueuePayload = JSON.parse(job.payload)
    const classPayload = JSON.parse(body.classPayload) as JobOptions
    const maxTries = Number(classPayload.tries || 3)

    // Track active job
    if (job.id) {
      workerState.activeJobs.add(job.id)
    }

    // Emit job processing event
    await emitQueueEvent('job:processing', {
      jobId: String(job.id),
      queueName: job.queue,
      jobName: body.name,
      data: body.params,
      attemptsMade: currentAttempts,
    })

    log.info(`Running job: ${body.path}`)

    // Mark job as reserved
    const now = timestampNow()
    await updateJobReservation(job, currentAttempts, now)

    const startTime = Date.now()

    try {
      // Run the job
      await runJob(body.name, {
        queue: job.queue,
        payload: body.params,
        context: '',
        maxTries,
        timeout: 60,
      })

      const duration = Date.now() - startTime

      // If job is successful, delete it
      await job.delete()

      // Emit job completed event
      await emitQueueEvent('job:completed', {
        jobId: String(job.id),
        queueName: job.queue,
        jobName: body.name,
        duration,
        attemptsMade: currentAttempts,
      })

      log.info(`Successfully ran job: ${body.path} in ${duration}ms`)
    }
    catch (error) {
      const duration = Date.now() - startTime

      // Increment the attempt count
      currentAttempts++

      if (currentAttempts > maxTries) {
        // If attempts exceed maxTries, store as failed job and delete
        const stringifiedError = error instanceof Error ? error.stack || error.message : JSON.stringify(error)

        await storeFailedJob(job, stringifiedError, currentAttempts, maxTries)
        await job.delete()

        // Emit job failed event
        await emitQueueEvent('job:failed', {
          jobId: String(job.id),
          queueName: job.queue,
          jobName: body.name,
          error: error as Error,
          duration,
          attemptsMade: currentAttempts,
        })

        log.error(`Job ${body.path} failed after ${maxTries} attempts:`, error)
      }
      else {
        const addedDelay = addDelay(job.available_at, currentAttempts, classPayload)

        await updateJobAttempts(job, currentAttempts, addedDelay)

        // Emit job retrying event
        await emitQueueEvent('job:retrying', {
          jobId: String(job.id),
          queueName: job.queue,
          jobName: body.name,
          error: error as Error,
          attemptsMade: currentAttempts,
        })

        log.warn(`Job ${body.path} failed, will retry (attempt ${currentAttempts}/${maxTries})`)
      }
    }
    finally {
      // Remove from active jobs
      if (job.id) {
        workerState.activeJobs.delete(job.id)
      }
    }
  }
}

/**
 * Enforce maximum delay
 */
function enforceMaxDelay(maxDelay: number | undefined, delay: number): number {
  return maxDelay !== undefined ? Math.min(delay, maxDelay) : delay
}

/**
 * Calculate delay for job retry
 */
function addDelay(
  timestamp: number | undefined,
  currentAttempts: number,
  classPayload: JobOptions,
): number {
  const now = timestampNow()
  const effectiveTimestamp = timestamp ?? now

  const backOff = classPayload.backoff
  const backoffConfig = classPayload.backoffConfig
  const jitter = backoffConfig?.jitter
  const maxDelay = backoffConfig?.maxDelay ? millisecondsToSeconds(backoffConfig.maxDelay) : undefined

  // Fixed backoff strategy logic
  if (backoffConfig && backoffConfig.strategy === 'fixed') {
    let delay = millisecondsToSeconds(backoffConfig.initialDelay)

    if (jitter?.enabled) {
      delay = applyJitter(delay, jitter)
    }

    return effectiveTimestamp + enforceMaxDelay(maxDelay, delay)
  }

  // Exponential backoff logic
  if (backoffConfig && backoffConfig.strategy === 'exponential' && backoffConfig.factor) {
    let delay = millisecondsToSeconds(backoffConfig.initialDelay) * (backoffConfig.factor ** (currentAttempts - 1))

    if (jitter?.enabled) {
      delay = applyJitter(delay, jitter)
    }

    return effectiveTimestamp + enforceMaxDelay(maxDelay, delay)
  }

  // Linear backoff logic
  if (backoffConfig && backoffConfig.strategy === 'linear' && backoffConfig.factor) {
    let delay = millisecondsToSeconds(backoffConfig.initialDelay) + backoffConfig.factor * (currentAttempts - 1)

    if (jitter?.enabled) {
      delay = applyJitter(delay, jitter)
    }

    return effectiveTimestamp + enforceMaxDelay(maxDelay, delay)
  }

  // Backoff as an array of delays (in milliseconds)
  if (Array.isArray(backOff)) {
    const backOffValueInMilliseconds = backOff[currentAttempts] || 0

    if (jitter?.enabled) {
      const delayWithJitter = applyJitter(backOffValueInMilliseconds, jitter)
      return effectiveTimestamp + enforceMaxDelay(maxDelay, delayWithJitter)
    }

    return effectiveTimestamp + enforceMaxDelay(maxDelay, millisecondsToSeconds(backOffValueInMilliseconds))
  }

  // Backoff as a single number (exponential backoff)
  if (typeof backOff === 'number') {
    const backoffInMilliseconds = currentAttempts ** backOff

    if (jitter?.enabled) {
      const delayWithJitter = applyJitter(backoffInMilliseconds, jitter)
      return effectiveTimestamp + enforceMaxDelay(maxDelay, delayWithJitter)
    }

    return effectiveTimestamp + enforceMaxDelay(maxDelay, millisecondsToSeconds(backoffInMilliseconds))
  }

  // Default to a 10-second retry delay if no backoff is configured
  return effectiveTimestamp + enforceMaxDelay(maxDelay, 10)
}

/**
 * Convert milliseconds to seconds
 */
function millisecondsToSeconds(milliseconds: number): number {
  return (milliseconds / 1000) || 1
}

/**
 * Apply jitter to delay value
 */
function applyJitter(delay: number, jitterConfig: JitterConfig): number {
  const factor = jitterConfig.factor || 0.5
  const randomJitter = Math.random() * delay * factor
  let jitteredDelay = delay + randomJitter

  // Apply minDelay and maxDelay if defined
  if (jitterConfig.minDelay !== undefined) {
    jitteredDelay = Math.max(jitteredDelay, jitterConfig.minDelay)
  }
  if (jitterConfig.maxDelay !== undefined) {
    jitteredDelay = Math.min(jitteredDelay, jitterConfig.maxDelay)
  }

  return Math.floor(jitteredDelay)
}

/**
 * Store a failed job with notification
 */
async function storeFailedJob(
  job: JobsModel,
  exception: string,
  attempts: number,
  maxAttempts: number,
): Promise<void> {
  const data = {
    connection: 'database',
    queue: job.queue,
    payload: job.payload,
    exception,
    failed_at: now(),
  }

  await FailedJob.create(data)

  // Send notification for failed job
  try {
    const body: QueuePayload = job.payload ? JSON.parse(job.payload) : { name: 'unknown', params: {} }

    await notifyJobFailed({
      id: job.id || 0,
      name: body.name,
      queue: job.queue || 'default',
      payload: body.params,
      exception,
      failedAt: new Date(),
      attempts,
      maxAttempts,
    })
  }
  catch (notifyError) {
    log.error('Failed to send job failure notification:', notifyError)
  }
}

/**
 * Get current timestamp as formatted string
 */
function now(): string {
  const date = new Date()

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * Update job attempts and delay
 */
async function updateJobAttempts(job: JobsModel, currentAttempts: number, delay: number | null): Promise<void> {
  try {
    const currentDelay = job.available_at

    if (currentDelay && delay) {
      await job.update({ attempts: currentAttempts, available_at: delay, reserved_at: null })
    }
    else {
      await job.update({ attempts: currentAttempts, reserved_at: null })
    }
  }
  catch (error) {
    log.error('Failed to update job attempts:', error)
  }
}

/**
 * Update job reservation (mark as being processed)
 */
async function updateJobReservation(job: JobsModel, attempts: number, reservedAt: number): Promise<void> {
  try {
    await job.update({ attempts, reserved_at: reservedAt })
  }
  catch (error) {
    log.error('Failed to update job reservation:', error)
  }
}

/**
 * Get current Unix timestamp in seconds
 */
function timestampNow(): number {
  const now = Date.now()
  return Math.floor(now / 1000)
}

/**
 * Check if the worker is currently running
 */
export function isWorkerRunning(): boolean {
  return workerState.isRunning
}

/**
 * Check if the worker is shutting down
 */
export function isWorkerShuttingDown(): boolean {
  return workerState.isShuttingDown
}

/**
 * Get the number of active jobs
 */
export function getActiveJobCount(): number {
  return workerState.activeJobs.size
}

/**
 * Stop the worker gracefully
 */
export async function stopWorker(): Promise<void> {
  if (!workerState.isRunning) {
    return
  }

  workerState.isShuttingDown = true

  // Clear intervals
  if (workerState.stalledCheckInterval) {
    clearInterval(workerState.stalledCheckInterval)
    workerState.stalledCheckInterval = null
  }

  if (workerState.processInterval) {
    clearTimeout(workerState.processInterval)
    workerState.processInterval = null
  }

  // Wait for active jobs
  const shutdownTimeout = 30000
  const startTime = Date.now()

  while (workerState.activeJobs.size > 0 && Date.now() - startTime < shutdownTimeout) {
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  await emitQueueEvent('worker:stopped', {
    queueName: 'all',
  })

  workerState.isRunning = false
}
