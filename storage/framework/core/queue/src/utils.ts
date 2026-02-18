import type { QueueOption } from '@stacksjs/types'
import { path } from '@stacksjs/path'

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

  const { db } = await import('@stacksjs/database')

  await db
    .insertInto('jobs')
    .values({
      queue: options.queue,
      payload: payloadJson,
      attempts: 0,
      available_at: generateUnixTimestamp(options.delay || 0),
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    })
    .execute()
}

function generateUnixTimestamp(secondsToAdd: number): number {
  const now = Date.now()
  return Math.floor((now / 1000) + secondsToAdd)
}
