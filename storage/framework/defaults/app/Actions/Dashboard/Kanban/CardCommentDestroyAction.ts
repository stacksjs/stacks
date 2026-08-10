import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { CardComment } from '@stacksjs/orm'
import { kanbanActionError, kanbanError } from './kanban-response'

/**
 * `DELETE /api/dashboard/kanban/comments/:id`.
 * The dashboard route applies its local-development or admin guard.
 */
export default new Action({
  name: 'Kanban Card Comment Destroy',
  description: 'Hard-deletes a single card comment.',
  method: 'DELETE',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isFinite(id) || id <= 0)
      return kanbanError('Invalid comment id', 400)

    try {
      const comment = await CardComment.find(id)
      if (!comment)
        return kanbanError('Comment not found.', 404)
      await comment.delete()
      return { deleted: true, id }
    }
    catch (err) {
      return kanbanActionError(err, 'CardCommentDestroyAction')
    }
  },
})
