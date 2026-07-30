import { Action } from '@stacksjs/actions'
import { findRole, getRolePermissions } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

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
      return response.json({ error: '`name` route param is required.' }, 400)
    }
    const url = new URL(request.url ?? 'http://localhost/')
    const guardName = (url.searchParams.get('guard') || 'web').trim()
    if (!guardName || guardName.length > 60) {
      return response.json({ error: 'Invalid guard name.' }, 400)
    }

    try {
      const role = await findRole(name, guardName)
      if (!role) {
        return response.json({ error: 'Role not found.' }, 404)
      }
      const permissions = (await getRolePermissions(role.id)).filter(permission => permission.guard_name === guardName)
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
      return response.json({ permissions: [], error: err instanceof Error ? err.message : 'unknown error' }, 500)
    }
  },
})
