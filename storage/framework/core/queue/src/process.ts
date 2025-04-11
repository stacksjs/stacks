import type { Ok } from '@stacksjs/error-handling'
import type { JobsModel } from '@stacksjs/orm'
import type { JitterConfig, JobOptions } from '@stacksjs/types'
import { ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/orm'
import { FailedJob } from '../../../orm/src/models/FailedJob'
import { runJob } from './job'

interface QueuePayload {
  path: string
  name: string
  maxTries: number
  timeOut: number | null
  timeOutAt: Date | null
  params: any
  classPayload: string
}

export async function processJobs(queue: string | undefined): Promise<Ok<string, never>> {
  async function process() {
    await executeJobs(queue)

    setTimeout(process, 1000)
  }

  process()

  return ok('Job processing has started successfully!')
}

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

async function executeJobs(queue: string | undefined): Promise<void> {
  const jobs = await Job.when(queue !== undefined, (query: JobModel) => query.where('queue', queue)).get()

  for (const job of jobs) {
    let currentAttempts = job.attempts || 1 // Assuming the job has an `attempts` field tracking its attempts

    if (!job.payload)
      continue

    if (job.available_at && job.available_at > timestampNow())
      continue

    const body: QueuePayload = JSON.parse(job.payload)

    const classPayload = JSON.parse(body.classPayload) as JobOptions

    const maxTries = Number(classPayload.tries || 3)

    log.info(`Running job: ${body.path}`)

    // Increment attempts before running the job
    await updateJobAttempts(job, currentAttempts, null)

    try {
      // Run the job
      await runJob(body.name, {
        queue: job.queue,
        payload: body.params,
        context: '',
        maxTries,
        timeout: 60,
      })

      // If job is successful, delete it
      await job.delete()
      log.info(`Successfully ran job: ${body.path}`)
    }
    catch (error) {
      // Increment the attempt count
      currentAttempts++

      if (currentAttempts > maxTries) {
        // If attempts exceed maxTries, store as failed job and delete
        const stringifiedError = JSON.stringify(error)
        storeFailedJob(job, stringifiedError)
        await job.delete() // Delete job only after exceeding maxTries
      }
      else {
        const addedDelay = addDelay(job.available_at, currentAttempts, classPayload)

        await updateJobAttempts(job, currentAttempts, addedDelay)
      }
    }
  }
}

function enforceMaxDelay(maxDelay: number | undefined, delay: number): number {
  return maxDelay !== undefined ? Math.min(delay, maxDelay) : delay
}

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
  const maxDelay = backoffConfig?.maxDelay ? meilisecondsToSeconds(backoffConfig.maxDelay) : undefined

  // Fixed backoff strategy logic
  if (backoffConfig && backoffConfig.strategy === 'fixed') {
    let delay = meilisecondsToSeconds(backoffConfig.initialDelay)

    if (jitter?.enabled) {
      delay = applyJitter(delay, jitter)
    }

    return effectiveTimestamp + enforceMaxDelay(maxDelay, delay)
  }

  // Exponential backoff logic
  if (backoffConfig && backoffConfig.strategy === 'exponential' && backoffConfig.factor) {
    let delay = meilisecondsToSeconds(backoffConfig.initialDelay) * (backoffConfig.factor ** (currentAttempts - 1))

    if (jitter?.enabled) {
      delay = applyJitter(delay, jitter)
    }

    return effectiveTimestamp + enforceMaxDelay(maxDelay, delay)
  }

  // Linear backoff logic
  if (backoffConfig && backoffConfig.strategy === 'linear' && backoffConfig.factor) {
    let delay = meilisecondsToSeconds(backoffConfig.initialDelay) + backoffConfig.factor * (currentAttempts - 1)

    if (jitter?.enabled) {
      delay = applyJitter(delay, jitter)
    }

    return effectiveTimestamp + enforceMaxDelay(maxDelay, delay)
  }

  // Backoff as an array of delays (in seconds), convert to milliseconds
  if (Array.isArray(backOff)) {
    const backOffValueInMilliseconds = backOff[currentAttempts] || 0

    if (jitter?.enabled) {
      const delayWithJitter = applyJitter(backOffValueInMilliseconds, jitter)
      return effectiveTimestamp + enforceMaxDelay(maxDelay, delayWithJitter)
    }

    return effectiveTimestamp + enforceMaxDelay(maxDelay, meilisecondsToSeconds(backOffValueInMilliseconds))
  }

  // Backoff as a single number (exponential or linear backoff), convert to milliseconds
  if (typeof backOff === 'number') {
    const backoffInMilliseconds = currentAttempts ** backOff

    if (jitter?.enabled) {
      const delayWithJitter = applyJitter(backoffInMilliseconds, jitter)
      return effectiveTimestamp + enforceMaxDelay(maxDelay, delayWithJitter)
    }

    return effectiveTimestamp + enforceMaxDelay(maxDelay, meilisecondsToSeconds(backoffInMilliseconds))
  }

  // Default to a 10-second retry delay if no backoff is configured
  return effectiveTimestamp + enforceMaxDelay(maxDelay, 10)
}

function meilisecondsToSeconds(meiliseconds: number): number {
  return (meiliseconds / 1000) || 1
}
// Function to apply jitter with minDelay and maxDelay
function applyJitter(delay: number, jitterConfig: JitterConfig): number {
  const factor = jitterConfig.factor || 0.5 // Default factor if not specified
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

async function storeFailedJob(job: JobModel, exception: string) {
  const data = {
    connection: 'database',
    queue: job.queue,
    payload: job.payload,
    exception,
    failed_at: now(),
  }

  await FailedJob.create(data)
}

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

async function updateJobAttempts(job: JobsModel, currentAttempts: number, delay: number | null): Promise<void> {
  try {
    const currentDelay = job.available_at

    if (currentDelay && delay) {
      await job.update({ attempts: currentAttempts, available_at: delay })
    }
    else {
      await job.update({ attempts: currentAttempts })
    }
  }
  catch (error) {
    log.error('Failed to update job attempts:', error)
  }
}

function timestampNow(): number {
  const now = Date.now()
  return Math.floor(now / 1000)
}
