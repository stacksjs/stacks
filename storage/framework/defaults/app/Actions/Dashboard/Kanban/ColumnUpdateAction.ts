import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { BoardColumn } from '@stacksjs/orm'
import { modelNullableString, modelNumber, modelString, modelValue, refreshModel } from './kanban-model'
import { kanbanActionError, kanbanError } from './kanban-response'

interface ColumnInput {
  name?: unknown
  color?: unknown
  cardLimit?: unknown
}

/**
 * `PATCH /api/dashboard/kanban/columns/:id`.
 *
 * Partial update for name / color / card limit. `position` and
 * `boardId` are NOT updatable here — moving a column between boards
 * isn't a feature (would orphan its cards' denormalised `board_id`);
 * reordering goes through `/columns/reorder` so transactions cover
 * the whole rewrite.
 */
export default new Action({
  name: 'Kanban Column Update',
  description: 'Partial update of a board column.',
  method: 'PATCH',
  apiResponse: true,
  async handle(request: RequestInstance<ColumnInput>) {
    const id = Number(request.getParam('id'))
    if (!Number.isFinite(id) || id <= 0) {
      return kanbanError('Invalid column id', 400)
    }

    const body = request.all()
    const set: Record<string, unknown> = {}

    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name || name.length > 80) {
        return kanbanError('`name` must be 1-80 characters.', 400)
      }
      set.name = name
    }
    if (typeof body.color === 'string' && body.color)
      set.color = body.color
    if (body.cardLimit !== undefined) {
      if (body.cardLimit === null) {
        set.cardLimit = null
      }
      else {
        const n = Number(body.cardLimit)
        if (!Number.isFinite(n) || n < 0) {
          return kanbanError('`cardLimit` must be a non-negative number or null.', 400)
        }
        set.cardLimit = n
      }
    }

    if (Object.keys(set).length === 0) {
      return kanbanError('No updatable fields provided.', 400)
    }

    try {
      const column = await BoardColumn.find(id)
      if (!column)
        return kanbanError('Column not found', 404)
      const updated = await refreshModel(await column.update(set))

      return {
        column: {
          id: modelNumber(updated, 'id'),
          uuid: modelNullableString(updated, 'uuid'),
          boardId: modelNumber(updated, 'boardId', 'board_id'),
          name: modelString(updated, 'name'),
          position: modelNumber(updated, 'position'),
          cardLimit: modelValue(updated, 'cardLimit', 'card_limit') == null
            ? null
            : modelNumber(updated, 'cardLimit', 'card_limit'),
          color: modelString(updated, 'color'),
        },
      }
    }
    catch (err) {
      return kanbanActionError(err, 'ColumnUpdateAction')
    }
  },
})
