import { Action } from '@stacksjs/actions'
import { deletePermission } from '@stacksjs/auth'

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
      return { error: '`name` route param is required.', status: 400 }
    }
    const url = new URL(request.url ?? 'http://localhost/')
    const guardName = url.searchParams.get('guard') || 'web'

    try {
      await deletePermission(name, guardName)
      return { deleted: true, name, guardName }
    }
    catch (err) {
      console.error('[dashboard/rbac] PermissionDestroyAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
