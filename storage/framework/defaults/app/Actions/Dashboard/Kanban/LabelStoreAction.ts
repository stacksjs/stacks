import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { kanbanError } from './kanban-response'

interface LabelInput {
  boardId?: unknown
  name?: unknown
  color?: unknown
}

/**
 * `POST /api/dashboard/kanban/labels` (stacksjs/stacks#1846 Phase 3).
 *
 * Creates a label scoped to a board. Labels are unique per
 * `(board_id, name)` — the migration enforces this via a unique
 * index, and the action rejects up front with a 409 rather than
 * letting the UNIQUE constraint fire.
 */
export default new Action({
  name: 'Kanban Label Store',
  description: 'Creates a label on a board.',
  method: 'POST',
  apiResponse: true,
  async handle(request) {
    const body = (request as any).jsonBody as LabelInput | undefined ?? {}

    const boardId = Number(body.boardId)
    if (!Number.isFinite(boardId) || boardId <= 0) {
      return kanbanError('`boardId` is required.', 400)
    }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 60) {
      return kanbanError('`name` is required and must be 1-60 characters.', 400)
    }
    const color = typeof body.color === 'string' && body.color ? body.color : 'slate'

    try {
      // Reject orphan labels: the board must exist.
      const boards = await db.unsafe('SELECT id FROM boards WHERE id = ? LIMIT 1', [boardId]).execute() as Array<{ id: number }>
      if (!boards?.length)
        return kanbanError('Board not found.', 404)

      // Pre-check uniqueness — clearer error than the DB's
      // `UNIQUE constraint failed: labels.board_id, labels.name`.
      const dup = await db.unsafe(
        'SELECT id FROM labels WHERE board_id = ? AND name = ? LIMIT 1',
        [boardId, name],
      ).execute() as Array<{ id: number }>
      if (dup?.length)
        return kanbanError('A label with that name already exists on this board.', 409)

      await db.insertInto('labels').values({ board_id: boardId, name, color }).execute()

      const inserted = await db.unsafe(
        'SELECT id, board_id, name, color FROM labels WHERE board_id = ? AND name = ? LIMIT 1',
        [boardId, name],
      ).execute() as Array<{ id: number, board_id: number, name: string, color: string }>
      const r = inserted?.[0]
      if (!r)
        return kanbanError('Label insert succeeded but follow-up read returned nothing.', 500)

      return {
        label: { id: r.id, boardId: r.board_id, name: r.name, color: r.color },
      }
    }
    catch (err) {
      console.error('[dashboard/kanban] LabelStoreAction failed:', err)
      return kanbanError(err instanceof Error ? err.message : 'unknown error', 500)
    }
  },
})
