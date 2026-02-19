import type { Request } from '@stacksjs/router'

import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

/**
 * Guest Middleware
 *
 * Ensures that the request is NOT authenticated. Useful for routes
 * that should only be accessible to unauthenticated users (e.g., login, register).
 *
 * Usage:
 * route.get('/login', 'LoginAction').middleware('guest')
 * route.post('/register', 'RegisterAction').middleware('guest')
 */
export default new Middleware({
  name: 'guest',
  priority: 1,

  async handle(request: Request) {
    const token = (request as any)._currentAccessToken || (request as any)._authenticatedUser

    if (token) {
      throw new HttpError(403, 'You are already authenticated.')
    }
  },
})
