import process from 'node:process'
import { log } from '@stacksjs/logging'
import { startProcessor } from '@stacksjs/queue'

// Prevent unhandled rejections from crashing the worker
process.on('unhandledRejection', (reason) => {
  log.error(`Unhandled Rejection in queue worker: ${reason}`)
})

process.on('uncaughtException', (error) => {
  log.error(`Uncaught Exception in queue worker: ${error.message}`)
})

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
  const errorMessage = error instanceof Error ? error.message : String(error)
  log.error(`Queue worker error: ${errorMessage}`)
  // Don't exit - try to keep running
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
