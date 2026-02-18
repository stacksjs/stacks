import type { QueueOption } from '@stacksjs/types'
import process from 'node:process'
import { path } from '@stacksjs/path'
// @ts-ignore - Job model path resolved at build time
import Job from '../../../orm/src/models/Job'

export async function storeJob(name: string, options: QueueOption): Promise<void> {
  const importedJob = (await import(path.appPath(`Jobs/${name}.ts`))).default

  const payloadJson = JSON.stringify({
    path: `app/Jobs/${name}.ts`,
    name,
    timeout: null,
    timeoutAt: null,
    params: options.payload || {},
    classPayload: JSON.stringify(importedJob),
  })

  const job = {
    queue: options.queue,
    payload: payloadJson,
    attempts: 0,
    available_at: generateUnixTimestamp(options.delay || 0),
  }

  await Job.create(job)
}

function generateUnixTimestamp(secondsToAdd: number): number {
  const now = Date.now()
  return Math.floor((now / 1000) + secondsToAdd)
}
