import process from 'node:process'
import { log } from '@stacksjs/logging'
import { pauseQueue } from '@stacksjs/queue'

const options = parseArgs()
const queue = options.queue
if (!queue) {
  log.error('Usage: buddy queue:pause --queue=<name> [--for=300]')
  process.exit(1)
}
const pauseSeconds = options.for ? Number.parseInt(options.for, 10) : 300

try {
  await pauseQueue(queue, pauseSeconds)
  log.success(`Paused queue '${queue}' for ${pauseSeconds}s`)
  process.exit(0)
}
catch (error) {
  log.error('Failed to pause queue', error)
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
