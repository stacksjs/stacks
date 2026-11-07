import { queueActionOptions } from './options'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { pauseQueue } from '@stacksjs/queue'

const options = queueActionOptions()
const queue = options.queue
if (!queue) {
  await log.error('Usage: buddy queue:pause --queue=<name> [--for=300]')
  process.exit(1)
}
const pauseSeconds = options.for ? Number.parseInt(options.for, 10) : 300

try {
  await pauseQueue(queue, pauseSeconds)
  log.success(`Paused queue '${queue}' for ${pauseSeconds}s`)
  await log.flush()
  process.exit(0)
}
catch (error) {
  await log.error('Failed to pause queue', error)
  process.exit(1)
}
