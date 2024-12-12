import process from 'node:process'
import { Action } from '@stacksjs/actions'

/**
 * A health check for your application.
 *
 * Please be aware, this action is used as a container health check. While you are encouraged
 * to extend this health check as you see fit, the framework requires the `status`
 * property to be present in the response of the `/health` endpoint.
 */

export default new Action({
  name: 'Health',
  description: 'A health check for your application.',
  path: '/health',

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
