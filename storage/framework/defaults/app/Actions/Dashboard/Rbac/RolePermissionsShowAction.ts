import { Action } from '@stacksjs/actions'
import { findRole, getRolePermissions } from '@stacksjs/auth'

/**
 * `GET /api/dashboard/rbac/roles/:name/permissions` (stacksjs/stacks#1845).
 *
 * Returns the permissions attached to a role. Drives the
 * Role-Permission matrix on the management page — when an admin
 * picks a role, this populates which permission checkboxes are
 * currently on.
 */
export default new Action({
  name: 'Dashboard RBAC Role Permissions Show',
  description: 'List permissions attached to one role.',
  method: 'GET',
  apiResponse: true,
  async handle(request) {
    const name = String((request as any)?.params?.name ?? '').trim()
    if (!name) {
      return { error: '`name` route param is required.', status: 400 }
    }
    const url = new URL(request.url ?? 'http://localhost/')
    const guardName = url.searchParams.get('guard') || 'web'

    try {
      const role = await findRole(name, guardName)
      if (!role) {
        return { error: 'Role not found.', status: 404 }
      }
      const permissions = await getRolePermissions(role.id)
      return {
        role: { id: role.id, name: role.name, guardName: role.guard_name },
        permissions: permissions.map(p => ({
          id: p.id,
          name: p.name,
          guardName: p.guard_name,
        })),
      }
    }
    catch (err) {
      console.error('[dashboard/rbac] RolePermissionsShowAction failed:', err)
      return { permissions: [], error: err instanceof Error ? err.message : 'unknown error' }
    }
  },
})
