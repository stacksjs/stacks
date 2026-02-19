import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

/**
 * Permission Middleware
 *
 * Checks if the authenticated user has the required permission(s).
 * Checks both direct permissions and permissions inherited via roles.
 * Must be used after the 'auth' middleware.
 *
 * Usage:
 * - 'permission:edit-posts' — requires the edit-posts permission
 * - 'permission:edit-posts,delete-posts' — requires any of the listed permissions
 *
 * Examples:
 * route.put('/posts/:id', 'UpdatePostAction').middleware('auth').middleware('permission:edit-posts')
 * route.delete('/posts/:id', 'DeletePostAction').middleware('auth').middleware('permission:delete-posts')
 */
export default new Middleware({
  name: 'permission',
  priority: 3,

  async handle(request) {
    const requiredPermissions = (request as any)._middlewareParams?.permission?.split(',').map((p: string) => p.trim()) || []

    if (requiredPermissions.length === 0) return

    const user = (request as any).user || (request as any)._user || null

    if (!user) {
      throw new HttpError(401, 'Unauthenticated.')
    }

    const { hasAnyPermission } = await import('@stacksjs/auth')

    const hasRequired = await hasAnyPermission(user, requiredPermissions)

    if (!hasRequired) {
      throw new HttpError(403, `User does not have any of the required permissions: ${requiredPermissions.join(', ')}`)
    }
  },
})
