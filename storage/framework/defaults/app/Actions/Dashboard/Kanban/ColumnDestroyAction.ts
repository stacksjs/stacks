import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { kanbanActionError, kanbanError } from './kanban-response'

/**
 * `DELETE /api/dashboard/kanban/columns/:id`.
 *
 * Hard-deletes the column and cascade-cleans every card inside it
 * (plus the pivot rows referencing those cards). Same convention as
 * BoardDestroyAction — Stacks doesn't lean on DB-level FK cascade, so
 * the cascade lives in this action.
 *
 * If you want to keep cards but remove the column, move the cards to
 * a different column first via the cards/reorder endpoint, then call
 * this on the empty column.
 */
export default new Action({
  name: 'Kanban Column Destroy',
  description: 'Hard-deletes a column and its cards.',
  method: 'DELETE',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isFinite(id) || id <= 0) {
      return kanbanError('Invalid column id', 400)
    }

    try {
      await db.transaction(async (rawTrx) => {
        const qb = rawTrx as unknown as typeof db
        await qb.unsafe(
          'DELETE FROM card_labels WHERE card_id IN (SELECT id FROM cards WHERE column_id = ?)',
          [id],
        ).execute()
        await qb.unsafe(
          'DELETE FROM card_assignees WHERE card_id IN (SELECT id FROM cards WHERE column_id = ?)',
          [id],
        ).execute()
        // Card comments are card-scoped children.
        await qb.unsafe(
          'DELETE FROM card_comments WHERE card_id IN (SELECT id FROM cards WHERE column_id = ?)',
          [id],
        ).execute()
        await qb.deleteFrom('cards').where('column_id', '=', id).execute()
        await qb.deleteFrom('board_columns').where('id', '=', id).execute()
      })
      return { deleted: true, id }
    }
    catch (err) {
      return kanbanActionError(err, 'ColumnDestroyAction')
    }
  },
})
