import { Action } from '@stacksjs/actions'
import { User } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { safeGet } from '../../../../resources/functions/dashboard/data'

/**
 * `GET /api/dashboard/rbac/users` (stacksjs/stacks#1845).
 *
 * Lightweight user list for the RBAC Users tab. Returns `{ id,
 * name, email }` only — enough to show a row label + run the
 * per-user role-sync UI. Bounded to 500 rows so a typo doesn't
 * dump the whole users table into one response (the page can
 * paginate / filter later if needed).
 *
 * Scoped to RBAC rather than reusing the kanban users list because:
 *   - The two surfaces have different role-gating contracts
 *     (kanban: admin+dev; RBAC: admin-only when the auth middleware
 *      is applied).
 *   - Future RBAC-specific filters (e.g. `?withoutRole=admin`)
 *     belong on this endpoint, not on the kanban one.
 */
export default new Action({
  name: 'Dashboard RBAC Users List',
  description: 'Lightweight user list for the RBAC assignment UI.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      const rows = await User.orderBy('name', 'asc').orderBy('id', 'asc').limit(500).get()
      return {
        users: rows.map((row) => {
          const name = safeGet(row, 'name')
          const email = safeGet(row, 'email')
          return {
            id: Number(safeGet(row, 'id', 0)),
            name: typeof name === 'string' ? name : null,
            email: typeof email === 'string' ? email : null,
          }
        }),
      }
    }
    catch (err) {
      console.error('[dashboard/rbac] UsersListAction failed:', err)
      return response.json({ users: [], error: err instanceof Error ? err.message : 'unknown error' }, 500)
    }
  },
})
