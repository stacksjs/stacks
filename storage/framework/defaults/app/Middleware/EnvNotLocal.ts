import { config } from '@stacksjs/config'
import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'EnvNotLocal',
  priority: 1,
  async handle() {
    const currentEnv = config.app.env || 'local'

    // Block access in local environment (allow all others)
    if (currentEnv === 'local') {
      throw new HttpError(
        403,
        `Access denied. This route is not available in local environment. Current environment: ${currentEnv}`,
      )
    }
  },
})
