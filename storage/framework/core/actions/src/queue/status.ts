import process from 'node:process'
import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/orm'
import { FailedJob } from '../../../orm/src/models/FailedJob'

const options = parseArgs()
const queueName = options.queue

try {
  log.info('Fetching queue status...\n')

  // Get all jobs grouped by queue
  const allJobs = queueName
    ? await Job.where('queue', queueName).get()
    : await Job.all()

  const failedJobs = queueName
    ? await FailedJob.where('queue', queueName).get()
    : await FailedJob.all()

  // Group jobs by queue
  const queueStats = new Map<string, { pending: number, processing: number, delayed: number }>()

  for (const job of allJobs) {
    const queue = job.queue || 'default'

    if (!queueStats.has(queue)) {
      queueStats.set(queue, { pending: 0, processing: 0, delayed: 0 })
    }

    const stats = queueStats.get(queue)!
    const now = Math.floor(Date.now() / 1000)

    if (job.reserved_at) {
      stats.processing++
    }
    else if (job.available_at && job.available_at > now) {
      stats.delayed++
    }
    else {
      stats.pending++
    }
  }

  // Group failed jobs by queue
  const failedStats = new Map<string, number>()
  for (const job of failedJobs) {
    const queue = job.queue || 'default'
    failedStats.set(queue, (failedStats.get(queue) || 0) + 1)
  }

  // Display header
  console.log('┌──────────────────────────────────────────────────┬──────────┬────────────┬──────────┬────────┐')
  console.log('│ Queue                                            │ Pending  │ Processing │ Delayed  │ Failed │')
  console.log('├──────────────────────────────────────────────────┼──────────┼────────────┼──────────┼────────┤')

  // Combine all queues
  const allQueues = new Set([...queueStats.keys(), ...failedStats.keys()])

  if (allQueues.size === 0) {
    console.log('│                        No queues found                                                   │')
  }
  else {
    for (const queue of allQueues) {
      const stats = queueStats.get(queue) || { pending: 0, processing: 0, delayed: 0 }
      const failed = failedStats.get(queue) || 0

      const queueDisplay = queue.substring(0, 48).padEnd(48)
      const pendingDisplay = String(stats.pending).padStart(8)
      const processingDisplay = String(stats.processing).padStart(10)
      const delayedDisplay = String(stats.delayed).padStart(8)
      const failedDisplay = String(failed).padStart(6)

      console.log(`│ ${queueDisplay} │${pendingDisplay} │${processingDisplay} │${delayedDisplay} │${failedDisplay} │`)
    }
  }

  console.log('└──────────────────────────────────────────────────┴──────────┴────────────┴──────────┴────────┘')

  // Summary
  const totalPending = Array.from(queueStats.values()).reduce((sum, s) => sum + s.pending, 0)
  const totalProcessing = Array.from(queueStats.values()).reduce((sum, s) => sum + s.processing, 0)
  const totalDelayed = Array.from(queueStats.values()).reduce((sum, s) => sum + s.delayed, 0)
  const totalFailed = Array.from(failedStats.values()).reduce((sum, n) => sum + n, 0)

  console.log(`\nSummary:`)
  console.log(`  Pending: ${totalPending}`)
  console.log(`  Processing: ${totalProcessing}`)
  console.log(`  Delayed: ${totalDelayed}`)
  console.log(`  Failed: ${totalFailed}`)
  console.log(`  Total: ${totalPending + totalProcessing + totalDelayed + totalFailed}`)

  process.exit(0)
}
catch (error) {
  log.error('Failed to get queue status', error)
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
    }
  })

  return args
}
