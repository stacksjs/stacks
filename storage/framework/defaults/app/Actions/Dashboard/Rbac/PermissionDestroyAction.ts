import { Action } from '@stacksjs/actions'
import { deletePermission } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

/**
 * `DELETE /api/dashboard/rbac/permissions/:name` (stacksjs/stacks#1845).
 *
 * Removes a permission by name + guard. Cascades through
 * role_permissions + user_permissions so the deleted permission
 * disappears from every role and user that held it.
 */
export default new Action({
  name: 'Dashboard RBAC Permission Destroy',
  description: 'Hard-delete a permission + its pivot rows.',
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
      await deletePermission(name, guardName)
      return { deleted: true, name, guardName }
    }
    catch (err) {
      console.error('[dashboard/rbac] PermissionDestroyAction failed:', err)
      return response.json({ error: err instanceof Error ? err.message : 'unknown error' }, 500)
    }
  },
})
