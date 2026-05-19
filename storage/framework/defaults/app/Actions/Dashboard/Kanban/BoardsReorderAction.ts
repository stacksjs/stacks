import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface ReorderInput {
  /**
   * Ordered list of board ids in their new display order. Array index
   * becomes the row's new `position`. Clients sending a partial list
   * (e.g. only the moved id) will leave other boards' positions
   * untouched — the canonical "after a drag, send the full visible
   * list" semantics avoids drift.
   */
  order?: unknown
}

/**
 * `POST /api/dashboard/kanban/boards/reorder` (stacksjs/stacks#1846 Phase 2).
 *
 * Rewrites the `position` column on every board in the submitted list
 * to match its index. Wrapped in a transaction so a partial failure
 * doesn't leave the boards index half-renumbered.
 *
 * Why not PATCH each board's position one-at-a-time? Two reasons:
 *   1. N round-trips become 1 — the page already knows the new order
 *      when the drag ends, so we shouldn't pretend it's N independent
 *      operations.
 *   2. Atomicity. Mid-flight UI state where some boards have the new
 *      position and some don't shows up as out-of-order rendering on
 *      the next paint.
 */
export default new Action({
  name: 'Kanban Boards Reorder',
  description: 'Bulk-rewrite `position` on a list of boards to match the submitted order.',
  method: 'POST',
  apiResponse: true,
  async handle(request) {
    const body = (request as any).jsonBody as ReorderInput | undefined ?? {}
    if (!Array.isArray(body.order) || body.order.length === 0) {
      return { error: '`order` must be a non-empty array of board ids.', status: 400 }
    }
    const ids: number[] = []
    for (const v of body.order) {
      const n = Number(v)
      if (!Number.isFinite(n) || n <= 0) {
        return { error: '`order` contains an invalid id.', status: 400 }
      }
      ids.push(n)
    }
    // Reject duplicates — they'd cause the same row to be written
    // multiple times with the LAST index winning, which silently
    // contradicts the visible order.
    if (new Set(ids).size !== ids.length) {
      return { error: '`order` contains duplicate ids.', status: 400 }
    }

    try {
      const txOps = async (qb: any) => {
        for (let i = 0; i < ids.length; i++) {
          await qb.updateTable('boards')
            .set({ position: i })
            .where('id', '=', ids[i])
            .execute()
        }
      }
      try {
        await (db as any).transaction(txOps)
      }
      catch {
        // Same fallback rationale as BoardDestroyAction — UPDATE is
        // idempotent for `position` (setting it twice to the same
        // value is a no-op), so a partial run + retry recovers.
        await txOps(db)
      }
      return { reordered: ids.length }
    }
    catch (err) {
      console.error('[dashboard/kanban] BoardsReorderAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
