import { queueActionOptions } from './options'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { db } from '@stacksjs/database'
import { getActiveJobCount, isWorkerRunning } from '@stacksjs/queue'

const options = queueActionOptions()
const queueName = options.queue
const refreshInterval = Number(options.interval) || 2000

let isRunning = true

// Handle graceful shutdown
process.on('SIGINT', () => {
  isRunning = false
  console.log('\n\nMonitoring stopped.')
  process.exit(0)
})

process.on('SIGTERM', () => {
  isRunning = false
  process.exit(0)
})

async function getStats() {
  const allJobs = queueName
    ? await db.selectFrom('jobs').selectAll().where('queue', '=', queueName).execute()
    : await db.selectFrom('jobs').selectAll().execute()

  const failedJobs = queueName
    ? await db.selectFrom('failed_jobs').selectAll().where('queue', '=', queueName).execute()
    : await db.selectFrom('failed_jobs').selectAll().execute()

  const now = Math.floor(Date.now() / 1000)

  let pending = 0
  let processing = 0
  let delayed = 0

  for (const job of allJobs) {
    if (job.reserved_at) {
      processing++
    }
    else if (job.available_at && Number(job.available_at) > now) {
      delayed++
    }
    else {
      pending++
    }
  }

  return {
    pending,
    processing,
    delayed,
    failed: failedJobs.length,
    total: allJobs.length,
    workerRunning: isWorkerRunning(),
    activeJobs: getActiveJobCount(),
  }
}

async function displayStats() {
  const stats = await getStats()
  const timestamp = new Date().toLocaleTimeString()

  // Clear screen and move cursor to top
  console.clear()

  console.log('┌────────────────────────────────────────────────────────────────┐')
  console.log('│                    Queue Monitor                               │')
  console.log('│                    Press Ctrl+C to exit                        │')
  console.log('├────────────────────────────────────────────────────────────────┤')
  console.log(`│ Last Updated: ${timestamp.padEnd(48)} │`)
  console.log(`│ Queue Filter: ${(queueName || 'All Queues').padEnd(48)} │`)
  console.log('├────────────────────────────────────────────────────────────────┤')
  console.log('│                                                                │')
  console.log(`│   Pending Jobs:     ${String(stats.pending).padStart(8)}                              │`)
  console.log(`│   Processing Jobs:  ${String(stats.processing).padStart(8)}                              │`)
  console.log(`│   Delayed Jobs:     ${String(stats.delayed).padStart(8)}                              │`)
  console.log(`│   Failed Jobs:      ${String(stats.failed).padStart(8)}                              │`)
  console.log('│                     ────────                              │')
  console.log(`│   Total Jobs:       ${String(stats.total).padStart(8)}                              │`)
  console.log('│                                                                │')
  console.log('├────────────────────────────────────────────────────────────────┤')
  console.log('│ Worker Status                                                  │')
  console.log('├────────────────────────────────────────────────────────────────┤')
  console.log(`│   Worker Running:   ${(stats.workerRunning ? 'Yes' : 'No').padEnd(8)}                              │`)
  console.log(`│   Active Jobs:      ${String(stats.activeJobs).padStart(8)}                              │`)
  console.log('│                                                                │')
  console.log('└────────────────────────────────────────────────────────────────┘')

  // Status indicators
  if (stats.failed > 0) {
    console.log(`\n⚠️  Warning: ${stats.failed} failed job(s) - run 'buddy queue:failed' for details`)
  }

  if (!stats.workerRunning && stats.pending > 0) {
    console.log(`\n⚠️  Warning: Worker not running but ${stats.pending} job(s) pending - run 'buddy queue:work'`)
  }
}

try {
  log.info('Starting queue monitor...\n')

  // Initial display
  await displayStats()

  // Refresh loop
  while (isRunning) {
    await new Promise(resolve => setTimeout(resolve, refreshInterval))
    if (isRunning) {
      await displayStats()
    }
  }
}
catch (error) {
  await log.error('Monitor error:', error)
  process.exit(1)
}
