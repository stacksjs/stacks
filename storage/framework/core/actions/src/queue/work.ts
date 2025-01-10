import process from 'node:process'
import { log } from '@stacksjs/logging'
import { processJobs } from '@stacksjs/queue'

const options = parseArgs()

const queue = options.queue

const result = await processJobs(queue)

if (result?.isErr()) {
  console.error(result.error)
  log.error('generateMigrations failed', result.error)
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
