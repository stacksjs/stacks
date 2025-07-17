import type { Request } from '@stacksjs/router'

import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'
import { config } from '@stacksjs/config'

export default new Middleware({
  name: 'EnvProduction',
  priority: 1,
  async handle(request: Request) {
    const currentEnv = config.app.env || 'local'
    
    // Only allow access in production environment
    if (currentEnv !== 'production' && currentEnv !== 'prod') {
      throw new HttpError(
        403, 
        `Access denied. This route is only available in production environment. Current environment: ${currentEnv}`
      )
    }
  },
}) 