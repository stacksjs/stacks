import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

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
      return { error: '`boardId` is required.', status: 400 }
    }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 60) {
      return { error: '`name` is required and must be 1-60 characters.', status: 400 }
    }
    const color = typeof body.color === 'string' && body.color ? body.color : 'slate'

    try {
      // Reject orphan labels: the board must exist.
      const boards = await db.unsafe('SELECT id FROM boards WHERE id = ? LIMIT 1', [boardId]).execute() as Array<{ id: number }>
      if (!boards?.length)
        return { error: 'Board not found.', status: 404 }

      // Pre-check uniqueness — clearer error than the DB's
      // `UNIQUE constraint failed: labels.board_id, labels.name`.
      const dup = await db.unsafe(
        'SELECT id FROM labels WHERE board_id = ? AND name = ? LIMIT 1',
        [boardId, name],
      ).execute() as Array<{ id: number }>
      if (dup?.length)
        return { error: 'A label with that name already exists on this board.', status: 409 }

      await db.insertInto('labels').values({ board_id: boardId, name, color }).execute()

      const inserted = await db.unsafe(
        'SELECT id, board_id, name, color FROM labels WHERE board_id = ? AND name = ? LIMIT 1',
        [boardId, name],
      ).execute() as Array<{ id: number, board_id: number, name: string, color: string }>
      const r = inserted?.[0]
      if (!r)
        return { error: 'Label insert succeeded but follow-up read returned nothing.', status: 500 }

      return {
        label: { id: r.id, boardId: r.board_id, name: r.name, color: r.color },
      }
    }
    catch (err) {
      console.error('[dashboard/kanban] LabelStoreAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
