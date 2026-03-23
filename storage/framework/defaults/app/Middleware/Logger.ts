import { log } from '@stacksjs/cli'
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'Logger',
  priority: 2,
  async handle(request) {
    const start = performance.now()
    const method = request?.method || 'UNKNOWN'
    const url = request?.url || 'unknown'
    const path = url ? new URL(url, 'http://localhost').pathname : 'unknown'

    log.info(`→ ${method} ${path}`)

    // Return undefined to continue middleware chain
    // The response timing is logged by the after hook if available
    return undefined
  },
})
