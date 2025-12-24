import process from 'node:process'
import { log } from '@stacksjs/logging'
import { startProcessor } from '@stacksjs/queue'

const options = parseArgs()

const queue = options.queue
const concurrency = Number(options.concurrency) || 1

log.info(`Starting queue worker with ${concurrency} concurrent worker(s)...`)

try {
  const result = await startProcessor(queue, {
    concurrency,
  })

  if (result.isErr) {
    log.error('Failed to start queue worker:', result.error)
    process.exit(1)
  }

  log.success('Queue worker started successfully!')

  // Keep the process running
  await new Promise(() => {})
}
catch (error) {
  log.error('Queue worker error:', error)
  process.exit(1)
}

function parseArgs(): { [key: string]: string } {
  const args: { [key: string]: string } = {}

  process.argv.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=')
      if (key && value) {
        args[key] = value
      }
      else if (key) {
        args[key] = 'true'
      }
    }
  })

  return args
}
