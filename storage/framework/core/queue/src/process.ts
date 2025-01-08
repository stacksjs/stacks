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

export async function processJobs(): Promise<Ok<string, never>> {
  const jobs = await Job.all()

  for (const job of jobs) {
    if (job.payload) {
      const payload: QueuePayload = JSON.parse(job.payload)
      const currentAttempts = job.attempts || 0
      log.info(`Running ${payload.displayName}`)

      job.update({ attempts: currentAttempts + 1 })

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

  return ok('All jobs processed successfully!')
}
