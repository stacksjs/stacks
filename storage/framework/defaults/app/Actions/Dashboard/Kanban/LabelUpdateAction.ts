import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Label } from '@stacksjs/orm'
import { modelNumber, modelString, refreshModel } from './kanban-model'
import { kanbanActionError, kanbanError } from './kanban-response'

interface LabelInput {
  name?: unknown
  color?: unknown
}

/**
 * `PATCH /api/dashboard/kanban/labels/:id`.
 *
 * Partial update for label name + color. `board_id` is not movable —
 * a label on board A renaming to "Bug" must not collide with a
 * pre-existing "Bug" label on board A (caught up front, rather than
 * letting the unique index fire its own error).
 */
export default new Action({
  name: 'Kanban Label Update',
  description: 'Partial update of a label name / color.',
  method: 'PATCH',
  apiResponse: true,
  async handle(request: RequestInstance<LabelInput>) {
    const id = Number(request.getParam('id'))
    if (!Number.isFinite(id) || id <= 0) {
      return kanbanError('Invalid label id', 400)
    }

    const body = request.all()
    const set: Record<string, unknown> = {}
    let renamingTo: string | null = null

    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name || name.length > 60) {
        return kanbanError('`name` must be 1-60 characters.', 400)
      }
      set.name = name
      renamingTo = name
    }
    if (typeof body.color === 'string' && body.color)
      set.color = body.color

    if (Object.keys(set).length === 0)
      return kanbanError('No updatable fields provided.', 400)

    try {
      const current = await Label.find(id)
      if (!current)
        return kanbanError('Label not found', 404)
      const boardId = modelNumber(current, 'boardId', 'board_id')
      const currentName = modelString(current, 'name')

      if (renamingTo && renamingTo !== currentName) {
        const duplicate = await Label
          .where('boardId', boardId)
          .where('name', renamingTo)
          .where('id', '!=', id)
          .first()
        if (duplicate)
          return kanbanError('A label with that name already exists on this board.', 409)
      }

      const updated = await refreshModel(await current.update(set))
      return {
        label: {
          id: modelNumber(updated, 'id'),
          boardId: modelNumber(updated, 'boardId', 'board_id'),
          name: modelString(updated, 'name'),
          color: modelString(updated, 'color'),
        },
      }
    }
    catch (err) {
      return kanbanActionError(err, 'LabelUpdateAction')
    }
  },
})
