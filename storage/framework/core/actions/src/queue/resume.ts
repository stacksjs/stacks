import process from 'node:process'
import { log } from '@stacksjs/logging'
import { resumeQueue } from '@stacksjs/queue'

const options = parseArgs()
const queue = options.queue
if (!queue) {
  log.error('Usage: buddy queue:resume --queue=<name>')
  process.exit(1)
}

try {
  await resumeQueue(queue)
  log.success(`Resumed queue '${queue}'`)
  process.exit(0)
}
catch (error) {
  log.error('Failed to resume queue', error)
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
