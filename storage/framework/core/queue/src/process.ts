import type { JobModel } from '../../../orm/src/models/Job'
import { ok, type Ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import FailedJob from '../../../orm/src/models/FailedJob'
import { Job } from '../../../orm/src/models/Job'
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
    if (!job.payload)
      continue

    if (job.available_at && job.available_at > timestampNow())
      continue

    const body: QueuePayload = JSON.parse(job.payload)
    const currentAttempts = job.attempts || 0

    log.info(`Running job: ${body.path}`)

    await updateJobAttempts(job, currentAttempts)

    try {
      await runJob(body.name, {
        queue: job.queue,
        payload: body.params,
        context: '',
        maxTries: body.maxTries,
        timeout: 60,
      })

      await job.delete()
      log.info(`Successfully ran job: ${body.path}`)
    }
    catch (error) {
      const stringifiedError = JSON.stringify(error)

      storeFailedJob(job, stringifiedError)
      log.error(`Job failed: ${body.path}`, stringifiedError)
    }
  }
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

async function updateJobAttempts(job: any, currentAttempts: number): Promise<void> {
  try {
    await job.update({ attempts: currentAttempts + 1 })
  }
  catch (error) {
    log.error('Failed to update job attempts:', error)
  }
}

function timestampNow(): number {
  const now = Date.now()
  return Math.floor(now / 1000)
}
