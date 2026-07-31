import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { kanbanError } from './kanban-response'

/**
 * `DELETE /api/dashboard/kanban/boards/:id` (stacksjs/stacks#1846 Phase 2).
 *
 * Hard delete with cascade: removes the board, its columns, its cards,
 * its labels, and the relevant pivot rows in `card_labels` and
 * `card_assignees`. No DB-level FK cascade to lean on — the existing
 * Stacks migration convention is app-layer integrity, so the cascade
 * lives in this action.
 *
 * Order matters: pivots first (they reference card_id), then cards,
 * then columns, then labels, then the board itself. Reverse-of-FK
 * order so no statement runs against rows that still have referents.
 *
 * Soft-archive is a different operation — call PATCH with
 * `{ archived: true }`. This action is the hard delete; data is gone.
 */
export default new Action({
  name: 'Kanban Board Destroy',
  description: 'Hard-deletes a board and all of its columns, cards, labels, and pivot rows.',
  method: 'DELETE',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0) {
      return kanbanError('Invalid board id', 400)
    }

    try {
      await db.transaction(async (rawTrx) => {
        const qb = rawTrx as unknown as typeof db
        // Pivots + card-scoped children first — they reference cards.
        await qb.unsafe(
          'DELETE FROM card_labels WHERE card_id IN (SELECT id FROM cards WHERE board_id = ?)',
          [id],
        ).execute()
        await qb.unsafe(
          'DELETE FROM card_assignees WHERE card_id IN (SELECT id FROM cards WHERE board_id = ?)',
          [id],
        ).execute()
        // Card comments (Phase 3, migration 0000000112). Same
        // card-scoped pattern as the pivots.
        await qb.unsafe(
          'DELETE FROM card_comments WHERE card_id IN (SELECT id FROM cards WHERE board_id = ?)',
          [id],
        ).execute()
        // Cards (denormalised board_id avoids the column join).
        await qb.deleteFrom('cards').where('board_id', '=', id).execute()
        // Columns + labels — both directly reference board_id.
        await qb.deleteFrom('board_columns').where('board_id', '=', id).execute()
        await qb.deleteFrom('labels').where('board_id', '=', id).execute()
        // Finally the board itself.
        await qb.deleteFrom('boards').where('id', '=', id).execute()
      })

      return { deleted: true, id }
    }
    catch (err) {
      console.error('[dashboard/kanban] BoardDestroyAction failed:', err)
      return kanbanError(err instanceof Error ? err.message : 'unknown error', 500)
    }
  },
})
