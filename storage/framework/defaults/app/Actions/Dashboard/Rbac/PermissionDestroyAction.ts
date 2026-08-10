import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { deletePermission } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { rbacActionError } from './rbac-response'

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
      await deletePermission(name, guardName)
      return { deleted: true, name, guardName }
    }
    catch (err) {
      return rbacActionError(err, 'The permission could not be deleted.', 'PermissionDestroyAction')
    }
  },
})
