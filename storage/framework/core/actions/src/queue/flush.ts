import { queueActionOptions } from './options'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { db } from '@stacksjs/database'

const options = queueActionOptions()
const queueName = options.queue
const force = options.force === 'true'

try {
  if (!force) {
    log.warn('This will permanently delete all failed jobs. Use --force to confirm.')
    await log.flush()
    process.exit(1)
  }

  // One scoped native delete avoids loading every payload into memory.
  let query = db.deleteFrom('failed_jobs')
  if (queueName) query = query.where('queue', '=', queueName)
  const result = await query.executeTakeFirst()
  const deletedCount = Number(result.numDeletedRows ?? 0)

  log.success(`Flushed ${deletedCount} failed job(s)`)
  await log.flush()
  process.exit(0)
}
catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  if (/no such table:\s*(?:jobs|failed_jobs)\b/i.test(message)) {
    process.stdout.write('Queue tables are not set up yet.\n')
    process.stdout.write('Run `buddy queue:table` to create the migrations, then `buddy migrate` to apply them.\n')
    process.exit(0)
  }
  await log.error('Failed to flush failed jobs', error)
  process.exit(1)
}
