import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

/**
 * `DELETE /api/dashboard/kanban/comments/:id` (stacksjs/stacks#1846 Phase 3).
 *
 * Hard-deletes a card comment. No authorship check yet — Phase 4
 * could add "only the author or an admin can delete" semantics by
 * looking at `request.user.id` vs the comment's `user_id`. For now
 * the dashboard's role-gated visibility (only admin+dev see the
 * surface) is the gate.
 */
export default new Action({
  name: 'Kanban Card Comment Destroy',
  description: 'Hard-deletes a single card comment.',
  method: 'DELETE',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0)
      return { error: 'Invalid comment id', status: 400 }

    try {
      await db.deleteFrom('card_comments').where('id', '=', id).execute()
      return { deleted: true, id }
    }
    catch (err) {
      console.error('[dashboard/kanban] CardCommentDestroyAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
