import process from 'node:process'
import { log } from '@stacksjs/logging'
import { startScheduler } from '@stacksjs/queue'

log.info('Starting job scheduler...')

try {
  await startScheduler()

  log.success('Scheduler is running. Press Ctrl+C to stop.')

  // Keep the process running
  await new Promise(() => {})
}
catch (error) {
  log.error('Failed to start scheduler:', error)
  process.exit(1)
}
