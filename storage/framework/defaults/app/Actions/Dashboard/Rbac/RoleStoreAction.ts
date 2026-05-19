import { Action } from '@stacksjs/actions'
import { createRole, findRole } from '@stacksjs/auth'

interface RoleInput {
  name?: unknown
  guardName?: unknown
  description?: unknown
}

/**
 * `POST /api/dashboard/rbac/roles` (stacksjs/stacks#1845).
 *
 * Creates a new role. Pre-checks uniqueness for (name, guard_name)
 * up front so the response carries a clean 409 instead of letting
 * the DB's unique-constraint surface bubble through as a 500.
 *
 * Idempotency note: the underlying BqbRbacStore swallows the
 * unique-violation race at the SQL level too, so concurrent calls
 * with the same (name, guard) settle on a single row regardless of
 * which one wins the SELECT-then-INSERT race.
 */
export default new Action({
  name: 'Dashboard RBAC Role Store',
  description: 'Create a new role.',
  method: 'POST',
  apiResponse: true,
  async handle(request) {
    const body = (request as any).jsonBody as RoleInput | undefined ?? {}

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 60) {
      return { error: '`name` is required and must be 1-60 characters.', status: 400 }
    }
    const guardName = typeof body.guardName === 'string' && body.guardName ? body.guardName.trim() : 'web'
    const description = typeof body.description === 'string' ? body.description.trim() : undefined

    try {
      const existing = await findRole(name, guardName)
      if (existing) {
        return { error: 'A role with that name and guard already exists.', status: 409 }
      }
      const role = await createRole(name, guardName, description)
      return {
        role: {
          id: role.id,
          name: role.name,
          guardName: role.guard_name,
          description: role.description ?? null,
          createdAt: role.created_at ?? null,
        },
      }
    }
    catch (err) {
      console.error('[dashboard/rbac] RoleStoreAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
