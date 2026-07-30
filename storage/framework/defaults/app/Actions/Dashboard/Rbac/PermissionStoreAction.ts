import { Action } from '@stacksjs/actions'
import { createPermission, findPermission } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

interface PermissionInput {
  name?: unknown
  guardName?: unknown
  description?: unknown
}

/**
 * `POST /api/dashboard/rbac/permissions` (stacksjs/stacks#1845).
 *
 * Mirrors RoleStoreAction. Permissions are typically dotted names
 * like `posts.publish` or `users.delete` — the dashboard imposes
 * no naming convention, that's an app-layer concern.
 */
export default new Action({
  name: 'Dashboard RBAC Permission Store',
  description: 'Create a new permission.',
  method: 'POST',
  apiResponse: true,
  async handle(request) {
    const body = (request as any).jsonBody as PermissionInput | undefined ?? {}

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 100) {
      return response.json({ error: '`name` is required and must be 1-100 characters.' }, 400)
    }
    const guardName = typeof body.guardName === 'string' && body.guardName ? body.guardName.trim() : 'web'
    const description = typeof body.description === 'string' ? body.description.trim() : undefined
    if (!guardName || guardName.length > 60) {
      return response.json({ error: '`guardName` must be 1-60 characters.' }, 400)
    }
    if (description && description.length > 255) {
      return response.json({ error: '`description` must be at most 255 characters.' }, 400)
    }

    try {
      const existing = await findPermission(name, guardName)
      if (existing) {
        return response.json({ error: 'A permission with that name and guard already exists.' }, 409)
      }
      const permission = await createPermission(name, guardName, description)
      return {
        permission: {
          id: permission.id,
          name: permission.name,
          guardName: permission.guard_name,
          description: permission.description ?? null,
          createdAt: permission.created_at ?? null,
        },
      }
    }
    catch (err) {
      console.error('[dashboard/rbac] PermissionStoreAction failed:', err)
      return response.json({ error: err instanceof Error ? err.message : 'unknown error' }, 500)
    }
  },
})
