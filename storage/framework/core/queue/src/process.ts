import { ok, type Ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { Job } from '../../../orm/src/models/Job'
import { runJob } from './job'

interface QueuePayload {
  displayName: string
  name: string
  maxTries: number
  timeOut: number | null
  timeOutAt: Date | null
}

export async function processJobs(queue: string | undefined): Promise<Ok<string, never>> {
  setInterval(async () => {
    await executeJobs(queue)
  }, 1000)

  return ok('All jobs processed successfully!')
}

async function executeJobs(queue: string | undefined): Promise<void> {
  const jobs = await Job.when(queue !== undefined, (query: any) => {
    return query.where('queue', queue)
  }).get()

  for (const job of jobs) {
    if (job.payload) {
      if (job.available_at && job.available_at > timestampNow())
        return

      const payload: QueuePayload = JSON.parse(job.payload)
      const currentAttempts = job.attempts || 0

      log.info(`Running ${payload.displayName}`)

      await job.update({ attempts: currentAttempts + 1 })

      try {
        await runJob(payload.name, {
          queue: job.queue,
          payload: {},
          context: '',
          maxTries: payload.maxTries,
          timeout: 60,
        })

        await job.delete()
      }
      catch (error) {
        log.info(`${payload.displayName} failed`)
        log.error(error)
      }

      log.info(`Successfully ran ${payload.displayName}`)
    }
  }
}

function timestampNow(): number {
  const now = Date.now()
  return Math.floor(now / 1000)
}
