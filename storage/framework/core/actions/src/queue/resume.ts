import { queueActionOptions } from './options'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { resumeQueue } from '@stacksjs/queue'

const options = queueActionOptions()
const queue = options.queue
if (!queue) {
  await log.error('Usage: buddy queue:resume --queue=<name>')
  process.exit(1)
}

try {
  await resumeQueue(queue)
  log.success(`Resumed queue '${queue}'`)
  await log.flush()
  process.exit(0)
}
catch (error) {
  await log.error('Failed to resume queue', error)
  process.exit(1)
}
