import type { Request } from '@stacksjs/router'

import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

/**
 * Ensure Email Is Verified Middleware
 *
 * Checks that the authenticated user has a verified email address.
 * Must be used after the 'auth' middleware.
 *
 * Usage:
 * route.get('/dashboard', 'DashboardAction').middleware('auth').middleware('verified')
 */
export default new Middleware({
  name: 'verified',
  priority: 4,

  async handle(request: Request) {
    const user = (request as any).user || (request as any)._user || null

    if (!user) {
      throw new HttpError(401, 'Unauthenticated.')
    }

    if (!user.email_verified_at) {
      throw new HttpError(403, 'Your email address is not verified.')
    }
  },
})
