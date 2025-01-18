import type { JobModel } from '../../../orm/src/models/Job'
import { ok, type Ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import FailedJob from '../../../orm/src/models/FailedJob'
import { Job } from '../../../orm/src/models/Job'
import { runJob } from './job'
import type { JitterConfig, JobOptions } from '@stacksjs/types'

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
    try {
      await executeJobs(queue)
    }
    catch (error) {
      log.error('Error processing jobs:', error)
    }

    setTimeout(process, 1000)
  }

  process()

  return ok('Job processing has started successfully!')
}

async function executeJobs(queue: string | undefined): Promise<void> {
  const jobs = await Job.when(queue !== undefined, (query: JobModel) => query.where('queue', queue)).get()

  for (const job of jobs) {
    let currentAttempts = job.attempts || 1  // Assuming the job has an `attempts` field tracking its attempts

    if (!job.payload) continue

    if (job.available_at && job.available_at > timestampNow()) continue

    const body: QueuePayload = JSON.parse(job.payload)
    const classPayload = JSON.parse(job.payload) as JobOptions

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
        await job.delete()  // Delete job only after exceeding maxTries
        log.error(`Job failed after ${maxTries} attempts: ${body.path}`, stringifiedError)
      } else {
       
        const addedDelay = addDelay(job.available_at, currentAttempts, classPayload)

        await updateJobAttempts(job, currentAttempts, addedDelay)
        log.error(`Job failed, retrying... Attempt ${currentAttempts}/${maxTries}: ${body.path}`)
      }
    }
  }
}

function addDelay(
  timestamp: number | undefined,
  currentAttempts: number,
  classPayload: JobOptions
): number {
  const now = timestampNow()
  const effectiveTimestamp = timestamp ?? now

  const backOff = classPayload.backoff
  const backoffConfig = classPayload.backoffConfig
  const jitter = backoffConfig?.jitter

  // Fixed backoff strategy logic
  if (backoffConfig && backoffConfig.strategy === 'fixed') {
    let delay = backoffConfig.initialDelay
    if (jitter?.enabled) {
      delay = applyJitter(delay, jitter)
    }
    return effectiveTimestamp + convertSecondsToTimeStamp(delay)
  }

  // Exponential backoff logic
  if (backoffConfig && backoffConfig.strategy === 'exponential' && backoffConfig.factor) {
    let delay = backoffConfig.initialDelay * (backoffConfig.factor ** (currentAttempts - 1))
    if (jitter?.enabled) {
      delay = applyJitter(delay, jitter)
    }
    return effectiveTimestamp + convertSecondsToTimeStamp(delay)
  }

  // Linear backoff logic
  if (backoffConfig && backoffConfig.strategy === 'linear' && backoffConfig.factor) {
    let delay = backoffConfig.initialDelay + backoffConfig.factor * (currentAttempts - 1)
    if (jitter?.enabled) {
      delay = applyJitter(delay, jitter)
    }
    return effectiveTimestamp + convertSecondsToTimeStamp(delay)
  }

  // Backoff as an array of delays (in seconds), convert to milliseconds
  if (Array.isArray(backOff)) {
    const backoffValueInSeconds = backOff[currentAttempts] || 0
    if (jitter?.enabled) {
      const delayWithJitter = applyJitter(backoffValueInSeconds, jitter)
      return effectiveTimestamp + convertSecondsToTimeStamp(delayWithJitter)
    }
    return effectiveTimestamp + convertSecondsToTimeStamp(backoffValueInSeconds)
  }

  // Backoff as a single number (exponential or linear backoff), convert to milliseconds
  if (typeof backOff === 'number') {
    const backoffInMilliseconds = currentAttempts ** backOff
    if (jitter?.enabled) {
      const delayWithJitter = applyJitter(backoffInMilliseconds, jitter)
      return effectiveTimestamp + convertSecondsToTimeStamp(delayWithJitter)
    }
    return effectiveTimestamp + convertSecondsToTimeStamp(backoffInMilliseconds)
  }

  return 0
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

function convertSecondsToTimeStamp(seconds: number): number {
  return seconds * 1000
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

async function updateJobAttempts(job: JobModel, currentAttempts: number, delay: number | null): Promise<void> {
  try {
    const currentDelay = job.available_at

    if (currentDelay && delay){
      await job.update({ attempts: currentAttempts, available_at: delay })
    } else {
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
