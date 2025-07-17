import type { Request } from '@stacksjs/router'

import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'
import { config } from '@stacksjs/config'

export default new Middleware({
  name: 'EnvStaging',
  priority: 1,
  async handle(request: Request) {
    const currentEnv = config.app.env || 'local'
    
    // Only allow access in staging environment
    if (currentEnv !== 'staging') {
      throw new HttpError(
        403, 
        `Access denied. This route is only available in staging environment. Current environment: ${currentEnv}`
      )
    }
  },
}) 