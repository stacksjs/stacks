import { Action } from '@stacksjs/actions'
import { getUserRoles } from '@stacksjs/auth'

/**
 * `GET /api/dashboard/rbac/users/:id/roles` (stacksjs/stacks#1845).
 *
 * Returns the roles attached to a single user. Drives the per-user
 * picker on the Users tab of the management page — when an admin
 * clicks a user, this populates the "currently assigned" set so
 * the sync UI can diff against it.
 */
export default new Action({
  name: 'Dashboard RBAC User Roles Show',
  description: 'List roles attached to one user.',
  method: 'GET',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id
    const userId = Number(rawId)
    if (!Number.isFinite(userId) || userId <= 0) {
      return { error: 'Invalid user id.', status: 400 }
    }

    try {
      const roles = await getUserRoles(userId)
      return {
        userId,
        roles: roles.map(r => ({
          id: r.id,
          name: r.name,
          guardName: r.guard_name,
        })),
      }
    }
    catch (err) {
      console.error('[dashboard/rbac] UserRolesShowAction failed:', err)
      return { userId, roles: [], error: err instanceof Error ? err.message : 'unknown error' }
    }
  },
})
