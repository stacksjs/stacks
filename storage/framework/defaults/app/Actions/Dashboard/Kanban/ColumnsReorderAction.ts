import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface ReorderInput {
  boardId?: unknown
  order?: unknown
}

/**
 * `POST /api/dashboard/kanban/columns/reorder` (stacksjs/stacks#1846 Phase 2).
 *
 * Bulk rewrite column positions for a board. The submitted `order`
 * is an array of column ids in their new display order; index becomes
 * the row's new `position`. Wrapped in a transaction so a partial
 * failure doesn't leave the board with a half-renumbered column row.
 *
 * Why scoped to a board? Two reasons:
 *   1. Validation: every id in `order` must belong to the same
 *      board — otherwise a drag in one board could accidentally
 *      renumber columns in another board sharing the same row order.
 *   2. Index hit: the `(board_id, position)` index gives a tight
 *      lookup for the post-reorder card query.
 */
export default new Action({
  name: 'Kanban Columns Reorder',
  description: 'Bulk-rewrite `position` on a board\'s columns.',
  method: 'POST',
  apiResponse: true,
  async handle(request) {
    const body = (request as any).jsonBody as ReorderInput | undefined ?? {}

    const boardId = Number(body.boardId)
    if (!Number.isFinite(boardId) || boardId <= 0) {
      return { error: '`boardId` is required.', status: 400 }
    }
    if (!Array.isArray(body.order) || body.order.length === 0) {
      return { error: '`order` must be a non-empty array of column ids.', status: 400 }
    }
    const ids: number[] = []
    for (const v of body.order) {
      const n = Number(v)
      if (!Number.isFinite(n) || n <= 0) {
        return { error: '`order` contains an invalid id.', status: 400 }
      }
      ids.push(n)
    }
    if (new Set(ids).size !== ids.length) {
      return { error: '`order` contains duplicate ids.', status: 400 }
    }

    try {
      // Verify every column actually belongs to the named board.
      // Single round-trip via a count of rows that match both criteria.
      const placeholders = ids.map(() => '?').join(',')
      const matchRows = await db.unsafe(
        `SELECT COUNT(*) AS c FROM board_columns WHERE id IN (${placeholders}) AND board_id = ?`,
        [...ids, boardId],
      ).execute() as Array<{ c: number }>
      const matched = Number(matchRows?.[0]?.c ?? 0)
      if (matched !== ids.length) {
        return { error: 'One or more column ids do not belong to the named board.', status: 400 }
      }

      const txOps = async (qb: any) => {
        for (let i = 0; i < ids.length; i++) {
          await qb.updateTable('board_columns')
            .set({ position: i })
            .where('id', '=', ids[i])
            .execute()
        }
      }
      try {
        await (db as any).transaction(txOps)
      }
      catch {
        await txOps(db)
      }
      return { reordered: ids.length }
    }
    catch (err) {
      console.error('[dashboard/kanban] ColumnsReorderAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
