import process from 'node:process'
import { log } from '@stacksjs/logging'
import { unquarantineJob } from '@stacksjs/queue'

const options = parseArgs()
const jobName = options.name
if (!jobName) {
  log.error('Usage: buddy queue:unquarantine --name=<JobName>')
  process.exit(1)
}

try {
  await unquarantineJob(jobName)
  log.success(`Lifted quarantine for ${jobName}`)
  process.exit(0)
}
catch (error) {
  log.error('Failed to unquarantine', error)
  process.exit(1)
}

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {}
  process.argv.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=')
      if (key && value) args[key] = value
    }
  })
  return args
}
