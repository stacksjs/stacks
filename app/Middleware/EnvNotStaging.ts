import { config } from '@stacksjs/config'
import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'EnvNotStaging',
  priority: 1,
  async handle() {
    const currentEnv = config.app.env || 'local'

    // Block access in staging environment (allow all others)
    if (currentEnv === 'staging') {
      throw new HttpError(
        403,
        `Access denied. This route is not available in staging environment. Current environment: ${currentEnv}`,
      )
    }
  },
})
