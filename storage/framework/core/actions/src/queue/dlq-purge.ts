import { queueActionOptions } from './options'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { purgeDeadLetterJobs } from '@stacksjs/queue'

const options = queueActionOptions()
const days = options.olderThanDays
  ? Number.parseInt(options.olderThanDays, 10)
  : (options['older-than-days'] ? Number.parseInt(options['older-than-days'], 10) : 30)

if (!Number.isFinite(days) || days < 1) {
  await log.error(`Invalid --older-than-days value '${options.olderThanDays ?? options['older-than-days']}'`)
  process.exit(1)
}

try {
  log.info(`Pruning dead-letter rows older than ${days} day(s)...`)
  const deleted = await purgeDeadLetterJobs(days)
  log.success(`Deleted ${deleted} dead-letter row(s)`)
  await log.flush()
  process.exit(0)
}
catch (error) {
  await log.error('Failed to purge dead-letter jobs', error)
  process.exit(1)
}
