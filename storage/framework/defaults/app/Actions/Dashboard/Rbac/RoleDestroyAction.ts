import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { deleteRole } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { rbacActionError } from './rbac-response'

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
      await deleteRole(name, guardName)
      return { deleted: true, name, guardName }
    }
    catch (err) {
      return rbacActionError(err, 'The role could not be deleted.', 'RoleDestroyAction')
    }
  },
})
