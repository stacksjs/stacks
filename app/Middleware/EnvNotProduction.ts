import { config } from '@stacksjs/config'
import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'EnvNotProduction',
  priority: 1,
  async handle() {
    const currentEnv = config.app.env || 'local'

    // Block access in production environment (allow all others)
    if (currentEnv === 'production' || currentEnv === 'prod') {
      throw new HttpError(
        403,
        `Access denied. This route is not available in production environment. Current environment: ${currentEnv}`,
      )
    }
  },
})
