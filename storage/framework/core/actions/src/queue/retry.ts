import process from 'node:process'
import { log } from '@stacksjs/logging'
import { executeFailedJobs, retryFailedJob } from '@stacksjs/queue'

const options = parseArgs()

const jobId = options.id
const all = options.all === 'true'

try {
  if (all) {
    log.info('Retrying all failed jobs...')
    await executeFailedJobs()
    log.success('All failed jobs have been queued for retry')
  }
  else if (jobId) {
    const id = Number.parseInt(jobId, 10)

    if (Number.isNaN(id)) {
      log.error('Invalid job ID provided')
      process.exit(1)
    }

    log.info(`Retrying failed job ${id}...`)
    await retryFailedJob(id)
    log.success(`Failed job ${id} has been queued for retry`)
  }
  else {
    log.warn('Please provide a job ID or use --all to retry all failed jobs')
    log.info('Usage: buddy queue:retry <id> or buddy queue:retry --all')
    process.exit(1)
  }

  process.exit(0)
}
catch (error) {
  log.error('Failed to retry job(s)', error)
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
