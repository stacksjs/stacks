import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

/**
 * `GET /api/dashboard/kanban/users` (stacksjs/stacks#1846 Phase 3).
 *
 * Lightweight user list for the assignee picker on the card detail
 * modal. Returns `{ id, name, email }` only — no roles, no profile,
 * no avatars. The modal renders initials from `name`, so anything
 * heavier would be wasted bytes.
 *
 * Scoped to the kanban route group so we don't conflate this with
 * the wider `/api/dashboard/users` (which the dashboard's Data
 * section uses and may eventually carry richer profile data). Drift
 * between the two is fine — different consumers, different needs.
 */
export default new Action({
  name: 'Kanban Users List',
  description: 'Lightweight user list for the kanban assignee picker.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      const rows = await db.unsafe(
        'SELECT id, name, email FROM users ORDER BY name ASC, id ASC LIMIT 500',
      ).execute() as Array<{ id: number, name: string | null, email: string | null }>
      return {
        users: (rows ?? []).map(r => ({ id: r.id, name: r.name, email: r.email })),
      }
    }
    catch (err) {
      console.error('[dashboard/kanban] UsersListAction failed:', err)
      return { users: [], error: err instanceof Error ? err.message : 'unknown error' }
    }
  },
})
