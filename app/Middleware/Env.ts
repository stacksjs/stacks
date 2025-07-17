import type { Request } from '@stacksjs/router'

import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'
import { config } from '@stacksjs/config'

export default new Middleware({
  name: 'Env',
  priority: 1,
  async handle(request: Request) {
    // Get the current environment from config
    const currentEnv = config.app.env || 'local'
    
    // For now, we'll create separate middleware for each environment
    // This can be extended later to support parameters
    const allowedEnvs = ['local', 'dev', 'development', 'staging', 'prod', 'production']
    
    // Check if current environment is in allowed environments
    if (!allowedEnvs.includes(currentEnv)) {
      throw new HttpError(
        403, 
        `Access denied. This route is only available in specific environments. Current environment: ${currentEnv}`
      )
    }
  },
}) 