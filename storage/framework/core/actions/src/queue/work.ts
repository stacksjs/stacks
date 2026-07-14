import process from 'node:process'
import { log } from '@stacksjs/logging'
import { startProcessor, stopProcessor } from '@stacksjs/queue'

// Prevent unhandled rejections from crashing the worker
process.on('unhandledRejection', (reason) => {
  log.error(`Unhandled Rejection in queue worker: ${reason}`)
})

process.on('uncaughtException', (error) => {
  log.error(`Uncaught Exception in queue worker: ${error.message}`)
})

// Graceful shutdown (stacksjs/stacks#1984). The worker loop runs in THIS
// spawned child process — `buddy queue:work` spawns it via runAction — so the
// drain has to happen HERE, where `workerRunning`/`inFlightJobs` actually live.
// Previously only the parent buddy CLI installed a SIGTERM/SIGINT handler, and
// its `stopProcessor()` ran against an empty in-process state while this child
// was terminated mid-`handle()`, abandoning in-flight jobs until the next
// worker's reservation sweep (up to an hour). A terminal Ctrl+C (SIGINT to the
// process group) and systemd's default `KillMode=control-group` (SIGTERM to the
// cgroup) both deliver the signal directly to this process, so drain on it:
// stop the poll loop and let in-flight jobs finish within the grace window; any
// still running past it are reclaimed by the reservation sweep.
const SHUTDOWN_GRACE_MS = Number(process.env.STACKS_QUEUE_SHUTDOWN_GRACE_MS) || 10_000
let shuttingDown = false
async function gracefulShutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown)
    return
  shuttingDown = true
  log.info(`[queue] Worker received ${signal}, draining in-flight jobs (max ${SHUTDOWN_GRACE_MS / 1000}s)…`)
  // Hard backstop: a wedged handler must not hold the worker open forever.
  setTimeout(() => {
    log.warn('[queue] Drain window exceeded — forcing worker exit.')
    process.exit(1)
  }, SHUTDOWN_GRACE_MS + 2_000).unref()
  try {
    await stopProcessor({ graceMs: SHUTDOWN_GRACE_MS })
  }
  catch (error) {
    log.error('[queue] Error while draining worker on shutdown:', error)
  }
  process.exit(0)
}
process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM') })
process.on('SIGINT', () => { void gracefulShutdown('SIGINT') })

const options = parseArgs()

const queue = options.queue
const concurrency = Number(options.concurrency) || 1

log.info(`Starting queue worker with ${concurrency} concurrent worker(s)...`)

const result = await startProcessor(queue, {
  concurrency,
})

if (result.isErr) {
  log.error('Failed to start queue worker:', result.error)
  process.exit(1)
}

log.success('Queue worker started successfully!')

// Keep the process running forever
await new Promise(() => {})

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
