import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { kanbanError } from './kanban-response'

/**
 * `DELETE /api/dashboard/kanban/labels/:id` (stacksjs/stacks#1846 Phase 3).
 *
 * Removes a label and detaches it from every card that carries it.
 * The label row goes from the `labels` table; every pivot row in
 * `card_labels` that references it goes too. Cards themselves are
 * untouched.
 */
export default new Action({
  name: 'Kanban Label Destroy',
  description: 'Hard-deletes a label and its card_labels pivot rows.',
  method: 'DELETE',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0)
      return kanbanError('Invalid label id', 400)

    try {
      await db.transaction(async (rawTrx) => {
        const qb = rawTrx as unknown as typeof db
        await qb.deleteFrom('card_labels').where('label_id', '=', id).execute()
        await qb.deleteFrom('labels').where('id', '=', id).execute()
      })
      return { deleted: true, id }
    }
    catch (err) {
      console.error('[dashboard/kanban] LabelDestroyAction failed:', err)
      return kanbanError(err instanceof Error ? err.message : 'unknown error', 500)
    }
  },
})
