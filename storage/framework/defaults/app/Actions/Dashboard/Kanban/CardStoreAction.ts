import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { BoardColumn, Card } from '@stacksjs/orm'
import { kanbanActionError, kanbanError } from './kanban-response'

interface CardInput {
  columnId?: unknown
  title?: unknown
  description?: unknown
  dueDate?: unknown
}

/**
 * `POST /api/dashboard/kanban/cards`.
 *
 * Creates a card at the end of the target column. `boardId` is
 * resolved server-side from `column.board_id` (denormalised onto the
 * card row) so clients don't pass it in — passing it from the page
 * would invite drift if the column was moved between boards (which
 * isn't a feature, but still).
 *
 * Stamps `created_by_user_id` from `request.user()` when the request is
 * authenticated; leaves it null for the no-auth dev dashboard so the
 * surface still works on localhost.
 */
export default new Action({
  name: 'Kanban Card Store',
  description: 'Creates a new card in a column.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance<CardInput>) {
    const body = request.all()

    const columnId = Number(body.columnId)
    if (!Number.isFinite(columnId) || columnId <= 0) {
      return kanbanError('`columnId` is required and must be a positive integer.', 400)
    }
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title || title.length > 300) {
      return kanbanError('`title` is required and must be 1-300 characters.', 400)
    }
    const description = typeof body.description === 'string' ? body.description.trim() : null
    const dueDate = typeof body.dueDate === 'string' && body.dueDate ? body.dueDate : null

    try {
      const column = await BoardColumn.find(columnId)
      if (!column) {
        return kanbanError('Column not found.', 404)
      }
      const boardId = Number(column.get('boardId') ?? column.get('board_id'))
      if (!Number.isFinite(boardId) || boardId <= 0)
        return kanbanError('Column is not attached to a valid board.', 409)

      const maxRow = await db.unsafe(
        'SELECT COALESCE(MAX(position), -1) AS m FROM cards WHERE column_id = ?',
        [columnId],
      ).execute() as Array<{ m: number }>
      const nextPosition = (Number(maxRow?.[0]?.m ?? -1) + 1) || 0

      const user = await request.user()
      const createdByUserId = user && Number.isInteger(Number(user.id)) ? Number(user.id) : null

      const card = await Card.create({
        columnId,
        boardId,
        title,
        description,
        position: nextPosition,
        createdByUserId,
        dueDate,
        archived: false,
      })

      return {
        card: {
          id: Number(card.get('id')),
          uuid: card.get('uuid') == null ? null : String(card.get('uuid')),
          columnId,
          boardId,
          title,
          description,
          position: nextPosition,
          createdByUserId,
          dueDate,
          archived: false,
          createdAt: card.get('createdAt') ?? card.get('created_at') ?? null,
          updatedAt: card.get('updatedAt') ?? card.get('updated_at') ?? null,
        },
      }
    }
    catch (err) {
      return kanbanActionError(err, 'CardStoreAction')
    }
  },
})
