import { config } from '@stacksjs/config'
import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'EnvProduction',
  priority: 1,
  async handle() {
    const currentEnv = config.app.env || 'local'

    // Only allow access in production environment
    if (currentEnv !== 'production' && currentEnv !== 'prod') {
      throw new HttpError(
        403,
        `Access denied. This route is only available in production environment. Current environment: ${currentEnv}`,
      )
    }
  },
})
