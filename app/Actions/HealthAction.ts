import process from 'node:process'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'Health',
  description: 'A health check for your application.',

  handle() {
    return {
      status: 'ok',
      uptime: Bun.nanoseconds(), // similar to process.uptime()
      memory: process.memoryUsage(),
      pid: process.pid,
      version: Bun.version,
      revision: Bun.revision,
    }
  },
})
