import { Action } from '@stacksjs/actions'
import { getUserRoles, syncRoles } from '@stacksjs/auth'

interface SyncInput {
  roles?: unknown
  guardName?: unknown
}

/**
 * `POST /api/dashboard/rbac/users/:id/roles` (stacksjs/stacks#1845).
 *
 * Replace-all sync: pass the full new role-name list and the
 * underlying facade attaches/detaches to match. Same semantics as
 * the kanban label/assignee sync endpoints.
 *
 * The facade resolves role names → role ids internally (and throws
 * if any name doesn't exist), so we surface those as 400s rather
 * than letting them bubble as 500s.
 */
export default new Action({
  name: 'Dashboard RBAC User Roles Sync',
  description: 'Replace the role set attached to one user.',
  method: 'POST',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id
    const userId = Number(rawId)
    if (!Number.isFinite(userId) || userId <= 0) {
      return { error: 'Invalid user id.', status: 400 }
    }

    const body = (request as any).jsonBody as SyncInput | undefined ?? {}
    if (!Array.isArray(body.roles)) {
      return { error: '`roles` must be an array of role names (possibly empty).', status: 400 }
    }
    const names: string[] = []
    for (const v of body.roles) {
      if (typeof v !== 'string' || !v.trim()) {
        return { error: '`roles` must contain non-empty strings.', status: 400 }
      }
      names.push(v.trim())
    }
    const guardName = typeof body.guardName === 'string' && body.guardName ? body.guardName.trim() : 'web'

    try {
      await syncRoles(userId, Array.from(new Set(names)), guardName)
      const after = await getUserRoles(userId)
      return {
        userId,
        roles: after.map(r => ({ id: r.id, name: r.name, guardName: r.guard_name })),
      }
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error'
      // The facade throws "Role 'X' not found" — surface as 400 so
      // the UI can show "this role doesn't exist anymore" rather
      // than a 500.
      if (msg.includes('not found')) {
        return { error: msg, status: 400 }
      }
      console.error('[dashboard/rbac] UserRolesSyncAction failed:', err)
      return { error: msg, status: 500 }
    }
  },
})
