import type { Request } from '@stacksjs/router'

import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

/**
 * Role Middleware
 *
 * Checks if the authenticated user has the required role(s).
 * Must be used after the 'auth' middleware.
 *
 * Usage:
 * - 'role:admin' — requires the admin role
 * - 'role:admin,editor' — requires any of the listed roles
 *
 * Examples:
 * route.get('/admin', 'AdminAction').middleware('auth').middleware('role:admin')
 * route.get('/content', 'ContentAction').middleware('auth').middleware('role:admin,editor')
 */
export default new Middleware({
  name: 'role',
  priority: 3,

  async handle(request: Request) {
    const requiredRoles = (request as any)._middlewareParams?.role?.split(',').map((r: string) => r.trim()) || []

    if (requiredRoles.length === 0) return

    const user = (request as any).user || (request as any)._user || null

    if (!user) {
      throw new HttpError(401, 'Unauthenticated.')
    }

    // Dynamically import to avoid circular dependency
    const { hasAnyRole } = await import('@stacksjs/auth')

    const hasRequired = await hasAnyRole(user, requiredRoles)

    if (!hasRequired) {
      throw new HttpError(403, `User does not have any of the required roles: ${requiredRoles.join(', ')}`)
    }
  },
})
