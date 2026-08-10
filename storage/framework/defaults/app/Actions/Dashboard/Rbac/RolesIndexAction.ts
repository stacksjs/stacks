import { Action } from '@stacksjs/actions'
import { getAllRoles } from '@stacksjs/auth'
import { rbacActionError } from './rbac-response'

/**
 * `GET /api/dashboard/rbac/roles` (stacksjs/stacks#1845).
 *
 * Returns every role in the system. The dashboard's permissions page
 * renders this as a list users can pick from when assigning roles.
 * Operational store failures use a real 500 response so the client can
 * distinguish an unavailable RBAC store from a valid empty role list.
 */
export default new Action({
  name: 'Dashboard RBAC Roles Index',
  description: 'List every role known to the RBAC store.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      const roles = await getAllRoles()
      return {
        roles: roles.map(r => ({
          id: r.id,
          name: r.name,
          guardName: r.guard_name,
          description: r.description ?? null,
          createdAt: r.created_at ?? null,
        })),
      }
    }
    catch (err) {
      return rbacActionError(err, 'Roles could not be loaded.', 'RolesIndexAction')
    }
  },
})
