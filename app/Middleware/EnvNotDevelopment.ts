import type { Request } from '@stacksjs/router'

import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'
import { config } from '@stacksjs/config'

export default new Middleware({
  name: 'EnvNotDevelopment',
  priority: 1,
  async handle(request: Request) {
    const currentEnv = config.app.env || 'local'
    
    // Block access in development environment (allow all others)
    if (currentEnv === 'development' || currentEnv === 'dev') {
      throw new HttpError(
        403, 
        `Access denied. This route is not available in development environment. Current environment: ${currentEnv}`
      )
    }
  },
}) 