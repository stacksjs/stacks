import type { JobOptions } from './job'
import Job from '../../../orm/src/models/Job'

export async function storeJob(name: string, options: JobOptions): Promise<void> {
  const payloadJson = JSON.stringify({
    displayName: `app/Jobs/${name}.ts`,
    name,
    maxTries: options.tries || 1,
    timeout: null,
    timeoutAt: null,
  })

  const job = {
    queue: options.queue,
    payload: payloadJson,
    attempts: 0,
  }

  await Job.create(job)
}
