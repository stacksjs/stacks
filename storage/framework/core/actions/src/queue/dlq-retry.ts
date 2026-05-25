import process from 'node:process'
import { log } from '@stacksjs/logging'
import { retryDeadLetterJob } from '@stacksjs/queue'

const options = parseArgs()
const idArg = options.id
if (!idArg) {
  log.error('Usage: buddy queue:dlq:retry --id=<id>')
  process.exit(1)
}
const id = Number.parseInt(idArg, 10)
if (Number.isNaN(id)) {
  log.error('Invalid id provided')
  process.exit(1)
}

try {
  const ok = await retryDeadLetterJob(id)
  if (!ok) {
    log.error(`Dead-letter job ${id} not found (or DLQ table missing)`)
    process.exit(1)
  }
  log.success(`Re-enqueued dead-letter job ${id}`)
  process.exit(0)
}
catch (error) {
  log.error('Failed to re-enqueue dead-letter job', error)
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
