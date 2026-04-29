import process from 'node:process'
import { log } from '@stacksjs/logging'
import { FailedJob } from '@stacksjs/orm'

const options = parseArgs()
const queueName = options.queue
const force = options.force === 'true'

try {
  if (!force) {
    log.warn('This will permanently delete all failed jobs. Use --force to confirm.')
    process.exit(1)
  }

  let deletedCount = 0

  if (queueName) {
    log.info(`Flushing all failed jobs from queue "${queueName}"...`)
    const failedJobs = await FailedJob.where('queue', queueName).get()
    deletedCount = failedJobs.length

    for (const job of failedJobs) {
      await (job as unknown as { delete: () => Promise<void> }).delete()
    }
  }
  else {
    log.info('Flushing all failed jobs from all queues...')
    const failedJobs = await FailedJob.all()
    deletedCount = failedJobs.length

    for (const job of failedJobs) {
      await (job as unknown as { delete: () => Promise<void> }).delete()
    }
  }

  log.success(`Flushed ${deletedCount} failed job(s)`)
  process.exit(0)
}
catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  if (/no such table:\s*(?:jobs|failed_jobs)\b/i.test(message)) {
    process.stdout.write('Queue tables are not set up yet.\n')
    process.stdout.write('Run `buddy queue:table` to create the migrations, then `buddy migrate` to apply them.\n')
    process.exit(0)
  }
  log.error('Failed to flush failed jobs', error)
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
