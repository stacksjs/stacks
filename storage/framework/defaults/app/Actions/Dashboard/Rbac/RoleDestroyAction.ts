import { Action } from '@stacksjs/actions'
import { deleteRole } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

/**
 * `DELETE /api/dashboard/rbac/roles/:name` (stacksjs/stacks#1845).
 *
 * Removes a role by name + guard. The underlying store cascades the
 * user_roles + role_permissions pivot rows so a deleted role doesn't
 * leave orphan attachments. No notification to formerly-assigned
 * users — the dashboard's role-gated visibility re-evaluates on the
 * next page load.
 */
export default new Action({
  name: 'Dashboard RBAC Role Destroy',
  description: 'Hard-delete a role + its pivot rows.',
  method: 'DELETE',
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
      await deleteRole(name, guardName)
      return { deleted: true, name, guardName }
    }
    catch (err) {
      console.error('[dashboard/rbac] RoleDestroyAction failed:', err)
      return response.json({ error: err instanceof Error ? err.message : 'unknown error' }, 500)
    }
  },
})
