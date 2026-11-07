import { queueActionOptions } from './options'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { unquarantineJob } from '@stacksjs/queue'

const options = queueActionOptions()
const jobName = options.name
if (!jobName) {
  await log.error('Usage: buddy queue:unquarantine --name=<JobName>')
  process.exit(1)
}

try {
  await unquarantineJob(jobName)
  log.success(`Lifted quarantine for ${jobName}`)
  await log.flush()
  process.exit(0)
}
catch (error) {
  await log.error('Failed to unquarantine', error)
  process.exit(1)
}
