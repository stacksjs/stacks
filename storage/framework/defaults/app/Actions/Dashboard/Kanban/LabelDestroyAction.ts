import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { kanbanActionError, kanbanError } from './kanban-response'

/**
 * `DELETE /api/dashboard/kanban/labels/:id`.
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
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
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
      return kanbanActionError(err, 'LabelDestroyAction')
    }
  },
})
