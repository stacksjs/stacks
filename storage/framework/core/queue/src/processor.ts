/**
 * Enhanced Queue Processor with Concurrent Execution
 *
 * Processes jobs from the queue with support for:
 * - Concurrent job execution (configurable worker pool)
 * - Stalled job detection and recovery
 * - Event emissions for monitoring
 * - Graceful shutdown
 * - Failed job notifications
 */

import type { Ok } from '@stacksjs/error-handling'
import type { JobModel, JobsModel } from '@stacksjs/orm'
import type { JitterConfig, JobOptions, QueueOption } from '@stacksjs/types'
import { ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/orm'
import { FailedJob } from '../../../orm/src/models/FailedJob'
import { emitQueueEvent } from './events'
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

interface ProcessorConfig {
  /** Number of concurrent workers (default: 1) */
  concurrency: number
  /** Poll interval in milliseconds (default: 1000) */
  pollInterval: number
  /** Stalled job threshold in milliseconds (default: 30 minutes) */
  stalledThreshold: number
  /** Stalled check interval in milliseconds (default: 60 seconds) */
  stalledCheckInterval: number
  /** Graceful shutdown timeout in milliseconds (default: 30 seconds) */
  shutdownTimeout: number
}

interface WorkerState {
  isRunning: boolean
  isShuttingDown: boolean
  activeJobs: Map<number, Promise<void>>
  stalledCheckInterval: ReturnType<typeof setInterval> | null
  pollInterval: ReturnType<typeof setTimeout> | null
  config: ProcessorConfig
}

// Default configuration
const DEFAULT_CONFIG: ProcessorConfig = {
  concurrency: Number(process.env.QUEUE_CONCURRENCY) || 1,
  pollInterval: 1000,
  stalledThreshold: 30 * 60 * 1000, // 30 minutes
  stalledCheckInterval: 60 * 1000, // 1 minute
  shutdownTimeout: 30000, // 30 seconds
}

// Worker state management
const workerState: WorkerState = {
  isRunning: false,
  isShuttingDown: false,
  activeJobs: new Map(),
  stalledCheckInterval: null,
  pollInterval: null,
  config: { ...DEFAULT_CONFIG },
}

/**
 * Start the job processor with concurrent execution
 */
export async function startProcessor(
  queue?: string,
  config: Partial<ProcessorConfig> = {},
): Promise<Ok<string, never>> {
  if (workerState.isRunning) {
    return ok('Job processor is already running')
  }

  // Merge config
  workerState.config = { ...DEFAULT_CONFIG, ...config }
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

  log.info(`Queue processor started with ${workerState.config.concurrency} worker(s)${queue ? ` for queue: ${queue}` : ''}`)

  // Start polling
  poll(queue)

  return ok('Job processing has started successfully!')
}

/**
 * Poll for jobs and execute them concurrently
 */
async function poll(queue?: string): Promise<void> {
  if (workerState.isShuttingDown) {
    return
  }

  try {
    // Check if we have capacity for more jobs
    const availableSlots = workerState.config.concurrency - workerState.activeJobs.size

    if (availableSlots > 0) {
      // Fetch available jobs up to our capacity
      const jobs = await fetchAvailableJobs(queue, availableSlots)

      // Process each job concurrently
      for (const job of jobs) {
        if (workerState.isShuttingDown) {
          break
        }

        // Reserve the job immediately
        if (job.id && !workerState.activeJobs.has(job.id)) {
          const jobPromise = processJob(job)
          workerState.activeJobs.set(job.id, jobPromise)

          // Clean up when done
          jobPromise.finally(() => {
            if (job.id) {
              workerState.activeJobs.delete(job.id)
            }
          })
        }
      }
    }
  }
  catch (error) {
    log.error('Error polling for jobs:', error)
  }

  // Schedule next poll
  if (!workerState.isShuttingDown) {
    workerState.pollInterval = setTimeout(() => poll(queue), workerState.config.pollInterval)
  }
}

/**
 * Fetch available jobs from the queue
 */
async function fetchAvailableJobs(queue: string | undefined, limit: number): Promise<JobsModel[]> {
  const now = timestampNow()

  // Query for jobs that are:
  // 1. Not reserved (reserved_at is null)
  // 2. Available now (available_at <= now or null)
  // 3. Optionally filtered by queue name
  let query = Job.where('reserved_at', null)

  if (queue !== undefined) {
    query = query.where('queue', queue)
  }

  const jobs = await query.get()

  // Filter and limit in memory (for complex conditions)
  return jobs
    .filter((job: JobsModel) => {
      // Skip if already being processed
      if (job.id && workerState.activeJobs.has(job.id)) {
        return false
      }
      // Check availability
      if (job.available_at && job.available_at > now) {
        return false
      }
      return true
    })
    .slice(0, limit)
}

/**
 * Process a single job
 */
async function processJob(job: JobsModel): Promise<void> {
  if (!job.payload) {
    return
  }

  const body: QueuePayload = JSON.parse(job.payload)
  const classPayload = JSON.parse(body.classPayload) as JobOptions
  const maxTries = Number(classPayload.tries || 3)
  let currentAttempts = job.attempts || 0

  // Mark job as reserved
  const reservedAt = timestampNow()
  await updateJobReservation(job, currentAttempts + 1, reservedAt)

  // Emit processing event
  await emitQueueEvent('job:processing', {
    jobId: String(job.id),
    queueName: job.queue,
    jobName: body.name,
    data: body.params,
    attemptsMade: currentAttempts + 1,
  })

  log.info(`Processing job: ${body.name} (${job.id})`)
  const startTime = Date.now()

  try {
    // Execute the job with timeout
    await executeWithTimeout(body, classPayload, job.queue || 'default')

    const duration = Date.now() - startTime

    // Job succeeded - delete it
    await job.delete()

    // Emit completed event
    await emitQueueEvent('job:completed', {
      jobId: String(job.id),
      queueName: job.queue,
      jobName: body.name,
      duration,
      attemptsMade: currentAttempts + 1,
    })

    log.info(`Completed job: ${body.name} (${job.id}) in ${duration}ms`)
  }
  catch (error) {
    const duration = Date.now() - startTime
    currentAttempts++

    log.error(`Job ${body.name} (${job.id}) failed:`, error)

    if (currentAttempts >= maxTries) {
      // Max retries exceeded - move to failed jobs
      const errorMessage = error instanceof Error ? error.stack || error.message : JSON.stringify(error)

      await storeFailedJob(job, errorMessage, currentAttempts, maxTries)
      await job.delete()

      // Emit failed event
      await emitQueueEvent('job:failed', {
        jobId: String(job.id),
        queueName: job.queue,
        jobName: body.name,
        error: error as Error,
        duration,
        attemptsMade: currentAttempts,
      })

      log.error(`Job ${body.name} failed permanently after ${maxTries} attempts`)
    }
    else {
      // Schedule for retry
      const retryDelay = calculateRetryDelay(currentAttempts, classPayload)

      await job.update({
        attempts: currentAttempts,
        available_at: timestampNow() + retryDelay,
        reserved_at: null,
      })

      // Emit retrying event
      await emitQueueEvent('job:retrying', {
        jobId: String(job.id),
        queueName: job.queue,
        jobName: body.name,
        error: error as Error,
        attemptsMade: currentAttempts,
      })

      log.warn(`Job ${body.name} scheduled for retry in ${retryDelay}s (attempt ${currentAttempts}/${maxTries})`)
    }
  }
}

/**
 * Execute job with timeout
 */
async function executeWithTimeout(
  body: QueuePayload,
  classPayload: JobOptions,
  queue: string,
): Promise<void> {
  const timeout = (classPayload.timeout || 60) * 1000

  const jobPromise = executeJobHandler(body)

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Job ${body.name} timed out after ${timeout}ms`))
    }, timeout)
  })

  await Promise.race([jobPromise, timeoutPromise])
}

/**
 * Execute the actual job handler
 */
async function executeJobHandler(body: QueuePayload): Promise<void> {
  // Dynamic import of the job module
  const { appPath } = await import('@stacksjs/path')
  const jobModule = await import(appPath(`Jobs/${body.name}.ts`))
  const jobConfig = jobModule.default

  if (typeof jobConfig.handle === 'function') {
    await jobConfig.handle(body.params)
  }
  else if (typeof jobConfig.action === 'string') {
    const { runAction } = await import('@stacksjs/actions')
    await runAction(jobConfig.action)
  }
  else if (typeof jobConfig.action === 'function') {
    await jobConfig.action()
  }
  else if (typeof jobConfig === 'function') {
    await jobConfig(body.params)
  }
  else {
    throw new Error(`Job ${body.name} does not have a valid handler`)
  }
}

/**
 * Calculate retry delay based on backoff configuration
 */
function calculateRetryDelay(attempt: number, config: JobOptions): number {
  const backoffConfig = config.backoffConfig
  const backoff = config.backoff

  // Fixed backoff
  if (backoffConfig?.strategy === 'fixed') {
    return millisecondsToSeconds(backoffConfig.initialDelay || 1000)
  }

  // Exponential backoff
  if (backoffConfig?.strategy === 'exponential') {
    const delay = (backoffConfig.initialDelay || 1000) * Math.pow(backoffConfig.factor || 2, attempt - 1)
    const maxDelay = backoffConfig.maxDelay || 3600000 // 1 hour max
    return millisecondsToSeconds(Math.min(delay, maxDelay))
  }

  // Linear backoff
  if (backoffConfig?.strategy === 'linear') {
    const delay = (backoffConfig.initialDelay || 1000) + (backoffConfig.factor || 1000) * (attempt - 1)
    const maxDelay = backoffConfig.maxDelay || 3600000
    return millisecondsToSeconds(Math.min(delay, maxDelay))
  }

  // Array of delays
  if (Array.isArray(backoff)) {
    return backoff[attempt - 1] || backoff[backoff.length - 1] || 10
  }

  // Simple exponential
  if (typeof backoff === 'number') {
    return Math.pow(backoff, attempt)
  }

  // Default: 10 seconds
  return 10
}

/**
 * Setup graceful shutdown
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

    if (workerState.pollInterval) {
      clearTimeout(workerState.pollInterval)
      workerState.pollInterval = null
    }

    // Wait for active jobs
    const startTime = Date.now()
    while (workerState.activeJobs.size > 0 && Date.now() - startTime < workerState.config.shutdownTimeout) {
      log.info(`Waiting for ${workerState.activeJobs.size} active job(s)...`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    if (workerState.activeJobs.size > 0) {
      log.warn(`Shutdown timeout reached with ${workerState.activeJobs.size} jobs still running`)
    }

    await emitQueueEvent('worker:stopped', { queueName: 'all' })

    workerState.isRunning = false
    log.info('Queue processor stopped gracefully')
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

/**
 * Start stalled job detection
 */
function startStalledJobDetection(queue?: string): void {
  workerState.stalledCheckInterval = setInterval(async () => {
    if (workerState.isShuttingDown) return

    try {
      await detectStalledJobs(queue)
    }
    catch (error) {
      log.error('Error detecting stalled jobs:', error)
    }
  }, workerState.config.stalledCheckInterval)
}

/**
 * Detect and recover stalled jobs
 */
async function detectStalledJobs(queue?: string): Promise<void> {
  const now = timestampNow()
  const stalledThreshold = now - Math.floor(workerState.config.stalledThreshold / 1000)

  const jobs = await Job.when(queue !== undefined, (q: JobModel) => q.where('queue', queue)).get()

  for (const job of jobs) {
    if (!job.payload || !job.reserved_at) continue

    // Job is stalled if reserved but not completed within threshold
    if (job.reserved_at < stalledThreshold) {
      log.warn(`Detected stalled job: ${job.id}`)

      await emitQueueEvent('job:stalled', {
        jobId: String(job.id),
        queueName: job.queue,
        attemptsMade: job.attempts,
      })

      // Release job back to queue
      await job.update({
        reserved_at: null,
        available_at: now,
      })

      log.info(`Released stalled job ${job.id} back to queue`)
    }
  }
}

/**
 * Store a failed job
 */
async function storeFailedJob(
  job: JobsModel,
  exception: string,
  attempts: number,
  maxAttempts: number,
): Promise<void> {
  await FailedJob.create({
    connection: 'database',
    queue: job.queue,
    payload: job.payload,
    exception,
    failed_at: formatTimestamp(new Date()),
  })

  // Send notification
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
  catch (error) {
    log.error('Failed to send job failure notification:', error)
  }
}

/**
 * Update job reservation
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
 * Utility functions
 */
function timestampNow(): number {
  return Math.floor(Date.now() / 1000)
}

function millisecondsToSeconds(ms: number): number {
  return Math.floor(ms / 1000) || 1
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * Exported state accessors
 */
export function isProcessorRunning(): boolean {
  return workerState.isRunning
}

export function isProcessorShuttingDown(): boolean {
  return workerState.isShuttingDown
}

export function getActiveJobCount(): number {
  return workerState.activeJobs.size
}

export function getProcessorConfig(): ProcessorConfig {
  return { ...workerState.config }
}

export async function stopProcessor(): Promise<void> {
  if (!workerState.isRunning) return

  workerState.isShuttingDown = true

  if (workerState.stalledCheckInterval) {
    clearInterval(workerState.stalledCheckInterval)
  }
  if (workerState.pollInterval) {
    clearTimeout(workerState.pollInterval)
  }

  // Wait for active jobs
  const promises = Array.from(workerState.activeJobs.values())
  await Promise.allSettled(promises)

  await emitQueueEvent('worker:stopped', { queueName: 'all' })
  workerState.isRunning = false
}
