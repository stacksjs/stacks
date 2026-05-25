import process from 'node:process'
import { log } from '@stacksjs/logging'
import { purgeDeadLetterJobs } from '@stacksjs/queue'

const options = parseArgs()
const days = options.olderThanDays
  ? Number.parseInt(options.olderThanDays, 10)
  : (options['older-than-days'] ? Number.parseInt(options['older-than-days'], 10) : 30)

if (!Number.isFinite(days) || days < 1) {
  log.error(`Invalid --older-than-days value '${options.olderThanDays ?? options['older-than-days']}'`)
  process.exit(1)
}

try {
  log.info(`Pruning dead-letter rows older than ${days} day(s)...`)
  const deleted = await purgeDeadLetterJobs(days)
  log.success(`Deleted ${deleted} dead-letter row(s)`)
  process.exit(0)
}
catch (error) {
  log.error('Failed to purge dead-letter jobs', error)
  process.exit(1)
}

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {}
  process.argv.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=')
      if (key && value) args[key] = value
    }
  })
  return args
}
