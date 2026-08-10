import { Action } from '@stacksjs/actions'
import { CardComment } from '@stacksjs/orm'
import { kanbanError } from './kanban-response'

/**
 * `DELETE /api/dashboard/kanban/comments/:id`.
 * The dashboard route applies its local-development or admin guard.
 */
export default new Action({
  name: 'Kanban Card Comment Destroy',
  description: 'Hard-deletes a single card comment.',
  method: 'DELETE',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const id = Number(rawId)
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
      console.error('[dashboard/kanban] CardCommentDestroyAction failed:', err)
      return kanbanError(err instanceof Error ? err.message : 'unknown error', 500)
    }
  },
})
