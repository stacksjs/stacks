import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface ColumnReorder {
  columnId: number
  order: number[]
}

interface ReorderInput {
  /**
   * Per-column ordered lists. Each entry rewrites every card in that
   * column to match the supplied order, AND sets `column_id` for any
   * card that moved in from a different column (cross-column drag).
   *
   * Example shape:
   *
   *   {
   *     columns: [
   *       { columnId: 1, order: [5, 3, 7] },   // Todo
   *       { columnId: 2, order: [4, 8] },       // In Progress
   *       { columnId: 3, order: [] },           // Done — emptied
   *     ]
   *   }
   *
   * Sending the full per-column state (not just the moved card)
   * avoids the "neighbour position drift" footgun where a card-move
   * leaves siblings with stale positions.
   */
  columns?: unknown
}

/**
 * `POST /api/dashboard/kanban/cards/reorder` (stacksjs/stacks#1846 Phase 2).
 *
 * The drag-and-drop hot path. Rewrites card positions and column
 * assignments across one or more columns of a single board in a single
 * transaction. Validates that every card and every column belongs to
 * the same board so a malformed payload can't reassign cards across
 * boards (would break `cards.board_id` denormalisation).
 *
 * Returns `{ moved: <count> }` — the count is informational for
 * client-side toast messages, not load-bearing.
 */
export default new Action({
  name: 'Kanban Cards Reorder',
  description: 'Bulk-rewrite cards.{column_id, position} across one or more columns of the same board.',
  method: 'POST',
  apiResponse: true,
  async handle(request) {
    const body = (request as any).jsonBody as ReorderInput | undefined ?? {}

    if (!Array.isArray(body.columns) || body.columns.length === 0) {
      return { error: '`columns` must be a non-empty array.', status: 400 }
    }

    // Parse + validate. Each entry needs a positive integer columnId
    // and a (possibly empty) array of positive integer card ids.
    const reorders: ColumnReorder[] = []
    const allCardIds = new Set<number>()
    for (const raw of body.columns) {
      if (!raw || typeof raw !== 'object')
        return { error: '`columns[]` entry must be an object.', status: 400 }
      const columnId = Number((raw as any).columnId)
      if (!Number.isFinite(columnId) || columnId <= 0)
        return { error: '`columns[].columnId` must be a positive integer.', status: 400 }
      if (!Array.isArray((raw as any).order))
        return { error: '`columns[].order` must be an array.', status: 400 }
      const order: number[] = []
      for (const v of (raw as any).order) {
        const n = Number(v)
        if (!Number.isFinite(n) || n <= 0)
          return { error: '`columns[].order` contains an invalid card id.', status: 400 }
        if (allCardIds.has(n))
          return { error: 'A card id appears in more than one column.', status: 400 }
        allCardIds.add(n)
        order.push(n)
      }
      reorders.push({ columnId, order })
    }

    if (reorders.length === 0) {
      return { moved: 0 }
    }

    try {
      // Verify all columns belong to the same board.
      const columnIds = reorders.map(r => r.columnId)
      const colPlaceholders = columnIds.map(() => '?').join(',')
      const colRows = await db.unsafe(
        `SELECT id, board_id FROM board_columns WHERE id IN (${colPlaceholders})`,
        columnIds,
      ).execute() as Array<{ id: number, board_id: number }>
      if (colRows.length !== columnIds.length) {
        return { error: 'One or more column ids do not exist.', status: 400 }
      }
      const boardIds = new Set(colRows.map(r => r.board_id))
      if (boardIds.size > 1) {
        return { error: 'All columns in a reorder request must belong to the same board.', status: 400 }
      }
      const boardId = colRows[0].board_id

      // Verify all cards belong to that board (prevents a malformed
      // page from moving cards in from a sibling board).
      if (allCardIds.size > 0) {
        const cardIdList = Array.from(allCardIds)
        const cardPlaceholders = cardIdList.map(() => '?').join(',')
        const cardRows = await db.unsafe(
          `SELECT id FROM cards WHERE id IN (${cardPlaceholders}) AND board_id = ?`,
          [...cardIdList, boardId],
        ).execute() as Array<{ id: number }>
        if (cardRows.length !== cardIdList.length) {
          return { error: 'One or more card ids do not belong to the named board.', status: 400 }
        }
      }

      // Single transaction: for each (columnId, order) entry, set
      // `column_id = columnId, position = index` on each card. Cards
      // moving across columns get both columns of their row rewritten;
      // cards staying put still get their position rewritten (cheap,
      // idempotent).
      const txOps = async (qb: any) => {
        for (const { columnId, order } of reorders) {
          for (let i = 0; i < order.length; i++) {
            await qb.updateTable('cards')
              .set({ column_id: columnId, position: i, board_id: boardId })
              .where('id', '=', order[i])
              .execute()
          }
        }
      }
      try {
        await (db as any).transaction(txOps)
      }
      catch {
        // Driver-specific transaction shape failed — sequential is
        // safe (each UPDATE is idempotent), but the page should
        // refetch on failure to confirm the final state.
        await txOps(db)
      }

      return { moved: allCardIds.size, boardId }
    }
    catch (err) {
      console.error('[dashboard/kanban] CardsReorderAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
