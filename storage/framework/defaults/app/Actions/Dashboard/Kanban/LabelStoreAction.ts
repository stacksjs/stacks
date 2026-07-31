import { Action } from '@stacksjs/actions'
import { Board, Label } from '@stacksjs/orm'
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
      const board = await Board.find(boardId)
      if (!board)
        return kanbanError('Board not found.', 404)

      const duplicate = await Label.where('boardId', boardId).where('name', name).first()
      if (duplicate)
        return kanbanError('A label with that name already exists on this board.', 409)

      const label = await Label.create({ boardId, name, color })

      return {
        label: { id: Number(label.get('id')), boardId, name, color },
      }
    }
    catch (err) {
      console.error('[dashboard/kanban] LabelStoreAction failed:', err)
      return kanbanError(err instanceof Error ? err.message : 'unknown error', 500)
    }
  },
})
