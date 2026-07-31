import { Action } from '@stacksjs/actions'
import { Board } from '@stacksjs/orm'
import { modelBoolean, modelNullableString, modelNumber, modelString, refreshModel } from './kanban-model'
import { kanbanError } from './kanban-response'

interface BoardInput {
  name?: unknown
  description?: unknown
  icon?: unknown
  color?: unknown
  archived?: unknown
}

/**
 * `PATCH /api/dashboard/kanban/boards/:id` (stacksjs/stacks#1846 Phase 2).
 *
 * Partial update — only the fields present in the body are written.
 * Omitting `archived` does NOT change the archive flag; passing
 * `archived: true` soft-archives the board (it drops out of the
 * /boards index but stays queryable at `/boards/:id`).
 *
 * `position` is intentionally NOT updatable here — bulk reordering
 * goes through `/boards/reorder` so the page can rewrite multiple
 * rows in one round-trip and avoid the gaps that single-row updates
 * leave behind. Position-via-PATCH would invite the "drag a card,
 * then the sibling row's position is wrong" footgun.
 */
export default new Action({
  name: 'Kanban Board Update',
  description: 'Partial update of a kanban board.',
  method: 'PATCH',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0) {
      return kanbanError('Invalid board id', 400)
    }

    const body = (request as any).jsonBody as BoardInput | undefined ?? {}
    const set: Record<string, unknown> = {}

    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name || name.length > 120) {
        return kanbanError('Name must be 1-120 characters.', 400)
      }
      set.name = name
    }
    if (typeof body.description === 'string' || body.description === null) {
      set.description = typeof body.description === 'string' ? body.description.trim() : null
    }
    if (typeof body.icon === 'string' && body.icon)
      set.icon = body.icon
    if (typeof body.color === 'string' && body.color)
      set.color = body.color
    if (typeof body.archived === 'boolean')
      set.archived = body.archived

    if (Object.keys(set).length === 0) {
      return kanbanError('No updatable fields provided.', 400)
    }

    try {
      const board = await Board.find(id)
      if (!board)
        return kanbanError('Board not found', 404)
      const updated = await refreshModel(await board.update(set))

      return {
        board: {
          id: modelNumber(updated, 'id'),
          uuid: modelNullableString(updated, 'uuid'),
          name: modelString(updated, 'name'),
          description: modelNullableString(updated, 'description'),
          icon: modelString(updated, 'icon'),
          color: modelString(updated, 'color'),
          position: modelNumber(updated, 'position'),
          archived: modelBoolean(updated, 'archived'),
          createdAt: modelNullableString(updated, 'createdAt', 'created_at'),
          updatedAt: modelNullableString(updated, 'updatedAt', 'updated_at'),
        },
      }
    }
    catch (err) {
      console.error('[dashboard/kanban] BoardUpdateAction failed:', err)
      return kanbanError(err instanceof Error ? err.message : 'unknown error', 500)
    }
  },
})
