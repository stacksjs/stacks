import { Action } from '@stacksjs/actions'
import { getUserRoles } from '@stacksjs/auth'
import { User } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

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
      return response.json({ error: 'Invalid user id.' }, 400)
    }
    const url = new URL(request.url ?? 'http://localhost/')
    const guardName = (url.searchParams.get('guard') || 'web').trim()
    if (!guardName || guardName.length > 60) {
      return response.json({ error: 'Invalid guard name.' }, 400)
    }

    try {
      if (!await User.find(userId)) {
        return response.json({ error: 'User not found.' }, 404)
      }
      const roles = (await getUserRoles(userId)).filter(role => role.guard_name === guardName)
      return {
        userId,
        guardName,
        roles: roles.map(r => ({
          id: r.id,
          name: r.name,
          guardName: r.guard_name,
        })),
      }
    }
    catch (err) {
      console.error('[dashboard/rbac] UserRolesShowAction failed:', err)
      return response.json({ userId, roles: [], error: err instanceof Error ? err.message : 'unknown error' }, 500)
    }
  },
})
