import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { kanbanActionError } from './kanban-response'
import { parseKanbanUserQuery, readKanbanUsers } from './kanban-users'

/**
 * `GET /api/dashboard/kanban/users`.
 *
 * Searchable user list for the assignee picker on the card detail
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
  async handle(request: RequestInstance) {
    const query = parseKanbanUserQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      // `?q=` searches name and email; `limit` bounds the answer, and `total`
      // says how many matched (kanban-users.ts).
      const { users, total } = await readKanbanUsers(query)
      return { users, total, limit: query.limit }
    }
    catch (err) {
      return kanbanActionError(err, 'UsersListAction')
    }
  },
})
