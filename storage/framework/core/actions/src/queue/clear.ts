import { queueActionOptions } from './options'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { db } from '@stacksjs/database'

const options = queueActionOptions()
const queueName = options.queue
const force = options.force === 'true'

try {
  if (!force) {
    log.warn('This will delete all jobs from the queue. Use --force to confirm.')
    await log.flush()
    process.exit(1)
  }

  // One scoped native delete avoids loading every payload into memory.
  let query = db.deleteFrom('jobs')
  if (queueName) query = query.where('queue', '=', queueName)
  const result = await query.executeTakeFirst()
  const deletedCount = Number(result.numDeletedRows ?? 0)

  log.success(`Cleared ${deletedCount} job(s)`)
  await log.flush()
  process.exit(0)
}
catch (error) {
  await log.error('Failed to clear jobs', error)
  process.exit(1)
}
