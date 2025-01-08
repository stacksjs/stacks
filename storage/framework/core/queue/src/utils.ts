import type { JobOptions } from './job'
import process from 'node:process'
import Job from '../../../orm/src/models/Job'

interface QueueOption extends JobOptions {
  delay: number
}

export async function storeJob(name: string, options: QueueOption): Promise<void> {
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
    available_at: generateUnixTimestamp(options.delay || 0),
  }

  await Job.create(job)

  process.exit()
}

function generateUnixTimestamp(secondsToAdd: number): number {
  const now = Date.now()
  return Math.floor((now / 1000) + secondsToAdd)
}
