import { Action } from '@stacksjs/actions'
import { getAllRoles } from '@stacksjs/auth'

/**
 * `GET /api/dashboard/rbac/roles` (stacksjs/stacks#1845).
 *
 * Returns every role in the system. The dashboard's permissions page
 * renders this as a list users can pick from when assigning roles.
 * Soft-errors to an empty list rather than 500 so a broken RBAC store
 * (e.g., migrations not run) renders an empty-state instead of
 * yelling at the user.
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
      console.error('[dashboard/rbac] RolesIndexAction failed:', err)
      return { roles: [], error: err instanceof Error ? err.message : 'unknown error' }
    }
  },
})
