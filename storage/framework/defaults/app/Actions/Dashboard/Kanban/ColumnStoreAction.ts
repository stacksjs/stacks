import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { Board, BoardColumn } from '@stacksjs/orm'
import { kanbanError } from './kanban-response'

interface ColumnInput {
  boardId?: unknown
  name?: unknown
  color?: unknown
  cardLimit?: unknown
}

/**
 * `POST /api/dashboard/kanban/columns` (stacksjs/stacks#1846 Phase 2).
 *
 * Appends a new column to the end of the target board. Validates that
 * `boardId` points at a real board so a typo doesn't silently create
 * an orphan column row.
 */
export default new Action({
  name: 'Kanban Column Store',
  description: 'Creates a new column on a board.',
  method: 'POST',
  apiResponse: true,
  async handle(request) {
    const body = (request as any).jsonBody as ColumnInput | undefined ?? {}

    const boardId = Number(body.boardId)
    if (!Number.isFinite(boardId) || boardId <= 0) {
      return kanbanError('`boardId` is required and must be a positive integer.', 400)
    }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 80) {
      return kanbanError('`name` is required and must be 1-80 characters.', 400)
    }
    const color = typeof body.color === 'string' && body.color ? body.color : 'slate'
    const cardLimit = body.cardLimit == null
      ? null
      : (Number.isFinite(Number(body.cardLimit)) && Number(body.cardLimit) >= 0
          ? Number(body.cardLimit)
          : null)

    try {
      const board = await Board.find(boardId)
      if (!board) {
        return kanbanError('Board not found.', 404)
      }

      const maxRow = await db.unsafe(
        'SELECT COALESCE(MAX(position), -1) AS m FROM board_columns WHERE board_id = ?',
        [boardId],
      ).execute() as Array<{ m: number }>
      const nextPosition = (Number(maxRow?.[0]?.m ?? -1) + 1) || 0

      const column = await BoardColumn.create({
        boardId,
        name,
        color,
        cardLimit,
        position: nextPosition,
      })

      return {
        column: {
          id: Number(column.get('id')),
          uuid: column.get('uuid') == null ? null : String(column.get('uuid')),
          boardId,
          name,
          position: nextPosition,
          cardLimit,
          color,
          cards: [],
        },
      }
    }
    catch (err) {
      console.error('[dashboard/kanban] ColumnStoreAction failed:', err)
      return kanbanError(err instanceof Error ? err.message : 'unknown error', 500)
    }
  },
})
