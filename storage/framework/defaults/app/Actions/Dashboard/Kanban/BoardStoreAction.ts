import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface BoardInput {
  name?: unknown
  description?: unknown
  icon?: unknown
  color?: unknown
}

/**
 * `POST /api/dashboard/kanban/boards` (stacksjs/stacks#1846 Phase 2).
 *
 * Creates a new board with sensible defaults and appends it to the
 * end of the boards list (`position = max(position) + 1` so the new
 * row shows up last in the index). Returns the inserted row including
 * its id so the optimistic-insert in the dashboard store can swap its
 * temp placeholder for the real record.
 *
 * Validation: title required + length-bounded; everything else is
 * optional with model-level defaults. The validation rules on the
 * `Board` model define the canonical contract; this action mirrors
 * the must-have subset so a malformed body doesn't reach `db`.
 */
export default new Action({
  name: 'Kanban Board Store',
  description: 'Creates a new kanban board.',
  method: 'POST',
  apiResponse: true,
  async handle(request) {
    const body = (request as any).jsonBody as BoardInput | undefined ?? {}

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 120) {
      return { error: 'Name is required and must be 1-120 characters.', status: 400 }
    }
    const description = typeof body.description === 'string' ? body.description.trim() : null
    const icon = typeof body.icon === 'string' && body.icon ? body.icon : 'rectangle.stack.fill'
    const color = typeof body.color === 'string' && body.color ? body.color : 'violet'

    try {
      // Position assignment: append at the end of the boards list.
      // Concurrent inserts could pick the same `position` (race between
      // the SELECT max() and the INSERT), but it's harmless — `position`
      // is a sort hint, not a unique key. Reorder via /boards/reorder
      // restores tight ordering when the user cares.
      const maxRow = await db.unsafe(
        'SELECT COALESCE(MAX(position), -1) AS m FROM boards WHERE archived = 0',
      ).execute() as Array<{ m: number }>
      const nextPosition = (Number(maxRow?.[0]?.m ?? -1) + 1) || 0

      await db.insertInto('boards').values({
        name,
        description,
        icon,
        color,
        position: nextPosition,
        archived: 0,
      }).execute()

      // SELECT the inserted row back. MySQL doesn't support RETURNING,
      // so we use the (name, position) pair as a best-effort identifier
      // — append-only with a unique position keeps this reliable.
      const inserted = await db.unsafe(
        `SELECT id, uuid, name, description, icon, color, position, archived, created_at, updated_at
        FROM boards
        WHERE name = ? AND position = ?
        ORDER BY id DESC
        LIMIT 1`,
        [name, nextPosition],
      ).execute() as Array<{ id: number, uuid: string | null, name: string, description: string | null, icon: string, color: string, position: number, archived: number, created_at: string | null, updated_at: string | null }>
      const row = inserted?.[0]
      if (!row) {
        return { error: 'Board insert succeeded but follow-up read returned nothing.', status: 500 }
      }

      return {
        board: {
          id: row.id,
          uuid: row.uuid,
          name: row.name,
          description: row.description,
          icon: row.icon,
          color: row.color,
          position: row.position,
          archived: row.archived === 1,
          cardCount: 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      }
    }
    catch (err) {
      console.error('[dashboard/kanban] BoardStoreAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
