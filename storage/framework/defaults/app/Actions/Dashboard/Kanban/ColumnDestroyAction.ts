import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { kanbanError } from './kanban-response'

/**
 * `DELETE /api/dashboard/kanban/columns/:id` (stacksjs/stacks#1846 Phase 2).
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
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const id = Number(rawId)
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
        // Card comments (Phase 3, stacksjs/stacks#1846).
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
      console.error('[dashboard/kanban] ColumnDestroyAction failed:', err)
      return kanbanError(err instanceof Error ? err.message : 'unknown error', 500)
    }
  },
})
