import { Action } from '@stacksjs/actions'
import { getAllPermissions } from '@stacksjs/auth'

/**
 * `GET /api/dashboard/rbac/permissions` (stacksjs/stacks#1845).
 *
 * Same shape as RolesIndexAction but against permissions. Drives the
 * Permissions tab on the management page + the column headers of the
 * Role-Permission matrix.
 */
export default new Action({
  name: 'Dashboard RBAC Permissions Index',
  description: 'List every permission known to the RBAC store.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      const permissions = await getAllPermissions()
      return {
        permissions: permissions.map(p => ({
          id: p.id,
          name: p.name,
          guardName: p.guard_name,
          description: p.description ?? null,
          createdAt: p.created_at ?? null,
        })),
      }
    }
    catch (err) {
      console.error('[dashboard/rbac] PermissionsIndexAction failed:', err)
      return { permissions: [], error: err instanceof Error ? err.message : 'unknown error' }
    }
  },
})
