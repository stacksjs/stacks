import { config } from '@stacksjs/config'
import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'EnvLocal',
  priority: 1,
  async handle() {
    const currentEnv = config.app.env || 'local'

    // Only allow access in local environment
    if (currentEnv !== 'local') {
      throw new HttpError(
        403,
        `Access denied. This route is only available in local environment. Current environment: ${currentEnv}`,
      )
    }
  },
})
