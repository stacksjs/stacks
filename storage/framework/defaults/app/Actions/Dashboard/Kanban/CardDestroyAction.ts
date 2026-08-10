import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { kanbanActionError, kanbanError } from './kanban-response'

/**
 * `DELETE /api/dashboard/kanban/cards/:id`.
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
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isFinite(id) || id <= 0) {
      return kanbanError('Invalid card id', 400)
    }

    try {
      await db.transaction(async (rawTrx) => {
        const qb = rawTrx as unknown as typeof db
        await qb.deleteFrom('card_labels').where('card_id', '=', id).execute()
        await qb.deleteFrom('card_assignees').where('card_id', '=', id).execute()
        // Card comments are card-scoped children.
        await qb.deleteFrom('card_comments').where('card_id', '=', id).execute()
        await qb.deleteFrom('cards').where('id', '=', id).execute()
      })
      return { deleted: true, id }
    }
    catch (err) {
      return kanbanActionError(err, 'CardDestroyAction')
    }
  },
})
