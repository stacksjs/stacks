import { Action } from '@stacksjs/actions'
import { Card } from '@stacksjs/orm'
import { modelBoolean, modelNullableString, modelNumber, modelString, modelValue, refreshModel } from './kanban-model'
import { kanbanError } from './kanban-response'

interface CardInput {
  title?: unknown
  description?: unknown
  dueDate?: unknown
  archived?: unknown
}

/**
 * `PATCH /api/dashboard/kanban/cards/:id` (stacksjs/stacks#1846 Phase 2).
 *
 * Partial update for the card body: title, description, due date,
 * archive flag. `position` and `columnId` are NOT updatable here —
 * card moves go through `/cards/reorder` which can rewrite multiple
 * rows transactionally and keep the denormalised `board_id` in sync
 * when a card crosses columns on different boards (rare but possible
 * if the page reordered a column move pair).
 */
export default new Action({
  name: 'Kanban Card Update',
  description: 'Partial update of a card body (title, description, due date, archive).',
  method: 'PATCH',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0) {
      return kanbanError('Invalid card id', 400)
    }

    const body = (request as any).jsonBody as CardInput | undefined ?? {}
    const set: Record<string, unknown> = {}

    if (typeof body.title === 'string') {
      const title = body.title.trim()
      if (!title || title.length > 300) {
        return kanbanError('`title` must be 1-300 characters.', 400)
      }
      set.title = title
    }
    if (typeof body.description === 'string' || body.description === null) {
      set.description = typeof body.description === 'string' ? body.description.trim() : null
    }
    if (typeof body.dueDate === 'string' || body.dueDate === null) {
      set.dueDate = typeof body.dueDate === 'string' && body.dueDate ? body.dueDate : null
    }
    if (typeof body.archived === 'boolean')
      set.archived = body.archived

    if (Object.keys(set).length === 0) {
      return kanbanError('No updatable fields provided.', 400)
    }

    try {
      const card = await Card.find(id)
      if (!card)
        return kanbanError('Card not found', 404)
      const updated = await refreshModel(await card.update(set))

      return {
        card: {
          id: modelNumber(updated, 'id'),
          uuid: modelNullableString(updated, 'uuid'),
          columnId: modelNumber(updated, 'columnId', 'column_id'),
          boardId: modelNumber(updated, 'boardId', 'board_id'),
          title: modelString(updated, 'title'),
          description: modelNullableString(updated, 'description'),
          position: modelNumber(updated, 'position'),
          createdByUserId: modelValue(updated, 'createdByUserId', 'created_by_user_id') == null
            ? null
            : modelNumber(updated, 'createdByUserId', 'created_by_user_id'),
          dueDate: modelNullableString(updated, 'dueDate', 'due_date'),
          archived: modelBoolean(updated, 'archived'),
          createdAt: modelNullableString(updated, 'createdAt', 'created_at'),
          updatedAt: modelNullableString(updated, 'updatedAt', 'updated_at'),
        },
      }
    }
    catch (err) {
      console.error('[dashboard/kanban] CardUpdateAction failed:', err)
      return kanbanError(err instanceof Error ? err.message : 'unknown error', 500)
    }
  },
})
