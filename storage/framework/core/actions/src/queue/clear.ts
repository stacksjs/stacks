import process from 'node:process'
import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/orm'

const options = parseArgs()
const queueName = options.queue
const force = options.force === 'true'

try {
  if (!force) {
    log.warn('This will delete all jobs from the queue. Use --force to confirm.')
    process.exit(1)
  }

  let deletedCount = 0

  if (queueName) {
    log.info(`Clearing all jobs from queue "${queueName}"...`)
    const jobs = await Job.where('queue', queueName).get()
    deletedCount = jobs.length

    for (const job of jobs) {
      await job.delete()
    }
  }
  else {
    log.info('Clearing all jobs from all queues...')
    const jobs = await Job.all()
    deletedCount = jobs.length

    for (const job of jobs) {
      await job.delete()
    }
  }

  log.success(`Cleared ${deletedCount} job(s)`)
  process.exit(0)
}
catch (error) {
  log.error('Failed to clear jobs', error)
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
