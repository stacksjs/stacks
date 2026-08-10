import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { findRole, getRolePermissions } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { rbacActionError } from './rbac-response'

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
  async handle(request: RequestInstance) {
    const name = request.getParam('name').trim()
    if (!name) {
      return response.json({ error: '`name` route param is required.' }, 400)
    }
    const guardName = String(request.get('guard', 'web')).trim()
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
      return rbacActionError(err, 'Role permissions could not be loaded.', 'RolePermissionsShowAction')
    }
  },
})
