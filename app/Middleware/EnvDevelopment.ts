import type { Request } from '@stacksjs/router'

import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'
import { config } from '@stacksjs/config'

export default new Middleware({
  name: 'EnvDevelopment',
  priority: 1,
  async handle(request: Request) {
    const currentEnv = config.app.env || 'local'
    
    // Only allow access in development environment
    if (currentEnv !== 'development' && currentEnv !== 'dev') {
      throw new HttpError(
        403, 
        `Access denied. This route is only available in development environment. Current environment: ${currentEnv}`
      )
    }
  },
}) 