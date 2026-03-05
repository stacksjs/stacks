import type { QueueOption } from '@stacksjs/types'

export async function storeJob(name: string, options: QueueOption): Promise<void> {
  const payloadJson = JSON.stringify({
    jobName: name,
    payload: options.payload || {},
    options: {
      queue: options.queue,
      tries: options.maxTries,
      timeout: options.timeout,
      backoff: options.backoff,
    },
  })

  const { db } = await import('@stacksjs/database')

  await db
    .insertInto('jobs')
    .values({
      queue: options.queue || 'default',
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
