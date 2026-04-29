import process from 'node:process'
import { log } from '@stacksjs/logging'
import { FailedJob } from '@stacksjs/orm'

const options = parseArgs()
const queueName = options.queue

try {
  log.info('Fetching failed jobs...\n')

  let failedJobs

  if (queueName) {
    failedJobs = await FailedJob.where('queue', queueName).get()
  }
  else {
    failedJobs = await FailedJob.all()
  }

  if (failedJobs.length === 0) {
    console.log('✓ No failed jobs found')
    process.exit(0)
  }

  // Display header
  console.log('┌─────┬──────────────────────────────────────────────────┬───────────────────────┬─────────────────────────────────┐')
  console.log('│ ID  │ Queue                                            │ Failed At             │ Exception                       │')
  console.log('├─────┼──────────────────────────────────────────────────┼───────────────────────┼─────────────────────────────────┤')

  for (const job of failedJobs) {
    const id = String(job.id).padEnd(3)
    const queue = (job.queue || 'default').substring(0, 48).padEnd(48)
    const failedAt = (job.failed_at || 'N/A').substring(0, 21).padEnd(21)
    const exception = (job.exception || 'Unknown error').substring(0, 31).padEnd(31)

    console.log(`│ ${id} │ ${queue} │ ${failedAt} │ ${exception} │`)
  }

  console.log('└─────┴──────────────────────────────────────────────────┴───────────────────────┴─────────────────────────────────┘')
  console.log(`\nTotal: ${failedJobs.length} failed job(s)`)

  process.exit(0)
}
catch (error) {
  // Surface a helpful prompt when the queue tables haven't been created yet,
  // matching queue:status behaviour. Without this, fresh projects see an
  // SQLite error stack instead of an actionable next step.
  const message = error instanceof Error ? error.message : String(error)
  if (/no such table:\s*(?:jobs|failed_jobs)\b/i.test(message)) {
    process.stdout.write('Queue tables are not set up yet.\n')
    process.stdout.write('Run `buddy queue:table` to create the migrations, then `buddy migrate` to apply them.\n')
    process.exit(0)
  }
  log.error('Failed to fetch failed jobs', error)
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
