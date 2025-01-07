import type { JobOptions } from "./job"
import process from 'node:process'
import Job from "../../../orm/src/models/Job"

export async function storeJob(name: string, options: JobOptions): Promise<void> {
  const queue = 'default'

  const payloadJson = JSON.stringify({
    displayName: `app/Jobs/${name}.ts`,
    maxTries: options.tries || 1,
    timeout: null,
    timeoutAt: null
  })

  const job = {
    queue,
    payload: payloadJson,
    attempts: 0,
  }

  await Job.create(job)
}