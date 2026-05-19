import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

/**
 * `DELETE /api/dashboard/kanban/cards/:id` (stacksjs/stacks#1846 Phase 2).
 *
 * Hard-deletes a card and clears its pivot rows in `card_labels` /
 * `card_assignees`. The columns and board are untouched — only the
 * single card row + its pivot dependencies go.
 *
 * Soft-archive (the more common ask) is a PATCH with
 * `{ archived: true }` — the card stays in the DB but drops out of
 * the board view. This action is the hard delete.
 */
export default new Action({
  name: 'Kanban Card Destroy',
  description: 'Hard-deletes a card and its pivot rows.',
  method: 'DELETE',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0) {
      return { error: 'Invalid card id', status: 400 }
    }

    try {
      const txOps = async (qb: any) => {
        await qb.deleteFrom('card_labels').where('card_id', '=', id).execute()
        await qb.deleteFrom('card_assignees').where('card_id', '=', id).execute()
        // Card comments (Phase 3, stacksjs/stacks#1846).
        await qb.deleteFrom('card_comments').where('card_id', '=', id).execute()
        await qb.deleteFrom('cards').where('id', '=', id).execute()
      }
      try {
        await (db as any).transaction(txOps)
      }
      catch {
        await txOps(db)
      }
      return { deleted: true, id }
    }
    catch (err) {
      console.error('[dashboard/kanban] CardDestroyAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
