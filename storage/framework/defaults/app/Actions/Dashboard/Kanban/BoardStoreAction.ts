import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { Board } from '@stacksjs/orm'
import { kanbanActionError, kanbanError } from './kanban-response'

interface BoardInput {
  name?: unknown
  description?: unknown
  icon?: unknown
  color?: unknown
}

/**
 * `POST /api/dashboard/kanban/boards`.
 *
 * Creates a new board with sensible defaults and appends it to the
 * end of the boards list (`position = max(position) + 1` so the new
 * row shows up last in the index). Returns the created model including
 * its id so the dashboard store can reconcile its optimistic state.
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
  async handle(request: RequestInstance<BoardInput>) {
    const body = request.all()

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 120) {
      return kanbanError('Name is required and must be 1-120 characters.', 400)
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
        'SELECT COALESCE(MAX(position), -1) AS m FROM boards WHERE archived = false',
      ).execute() as Array<{ m: number }>
      const nextPosition = (Number(maxRow?.[0]?.m ?? -1) + 1) || 0

      const board = await Board.create({
        name,
        description,
        icon,
        color,
        position: nextPosition,
        archived: false,
      })

      return {
        board: {
          id: Number(board.get('id')),
          uuid: board.get('uuid') == null ? null : String(board.get('uuid')),
          name,
          description,
          icon,
          color,
          position: nextPosition,
          archived: false,
          cardCount: 0,
          createdAt: board.get('createdAt') ?? board.get('created_at') ?? null,
          updatedAt: board.get('updatedAt') ?? board.get('updated_at') ?? null,
        },
      }
    }
    catch (err) {
      return kanbanActionError(err, 'BoardStoreAction')
    }
  },
})
