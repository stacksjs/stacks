import { Action } from '@stacksjs/actions'
import { getRolePermissions, findRole, syncRolePermissions } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

interface SyncInput {
  permissions?: unknown
  guardName?: unknown
}

/**
 * `POST /api/dashboard/rbac/roles/:name/permissions` (stacksjs/stacks#1845).
 *
 * Replace-all: pass the full new permission-name list. The facade
 * resolves names → ids and calls the store's syncRolePermissions
 * (which is `delete-then-insert` under the hood, transactional).
 */
export default new Action({
  name: 'Dashboard RBAC Role Permissions Sync',
  description: 'Replace the permission set attached to one role.',
  method: 'POST',
  apiResponse: true,
  async handle(request) {
    const roleName = String((request as any)?.params?.name ?? '').trim()
    if (!roleName) {
      return response.json({ error: '`name` route param is required.' }, 400)
    }

    const body = (request as any).jsonBody as SyncInput | undefined ?? {}
    if (!Array.isArray(body.permissions)) {
      return response.json({ error: '`permissions` must be an array of permission names (possibly empty).' }, 400)
    }
    const names: string[] = []
    for (const v of body.permissions) {
      if (typeof v !== 'string' || !v.trim() || v.trim().length > 100) {
        return response.json({ error: '`permissions` must contain non-empty strings.' }, 400)
      }
      names.push(v.trim())
    }
    const guardName = typeof body.guardName === 'string' && body.guardName ? body.guardName.trim() : 'web'
    if (!guardName || guardName.length > 60) {
      return response.json({ error: '`guardName` must be 1-60 characters.' }, 400)
    }

    try {
      await syncRolePermissions(roleName, Array.from(new Set(names)), guardName)
      // Re-fetch the role + its current permissions so the optimistic
      // UI can reconcile against canonical state.
      const role = await findRole(roleName, guardName)
      if (!role) {
        return response.json({ error: 'Role not found after sync.' }, 404)
      }
      const after = (await getRolePermissions(role.id)).filter(permission => permission.guard_name === guardName)
      return {
        role: { id: role.id, name: role.name, guardName: role.guard_name },
        permissions: after.map(p => ({ id: p.id, name: p.name, guardName: p.guard_name })),
      }
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error'
      if (msg.includes('not found')) {
        return response.json({ error: msg }, 400)
      }
      console.error('[dashboard/rbac] RolePermissionsSyncAction failed:', err)
      return response.json({ error: msg }, 500)
    }
  },
})
