import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { CardComment, User } from '@stacksjs/orm'
import { cardCommentResponse } from './kanban-comment'
import { modelNullableNumber, refreshModel } from './kanban-model'
import { kanbanActionError, kanbanError } from './kanban-response'

interface CommentInput {
  body?: unknown
}

/** `PATCH /api/dashboard/kanban/comments/:id`. */
export default new Action({
  name: 'Kanban Card Comment Update',
  description: 'Edits the body of a card comment.',
  method: 'PATCH',
  apiResponse: true,
  async handle(request: RequestInstance<CommentInput>) {
    const id = Number(request.getParam('id'))
    if (!Number.isFinite(id) || id <= 0)
      return kanbanError('Invalid comment id', 400)

    const input = request.all()
    const body = typeof input.body === 'string' ? input.body.trim() : ''
    if (!body || body.length > 10000)
      return kanbanError('`body` is required and must be 1-10000 characters.', 400)

    try {
      const comment = await CardComment.find(id)
      if (!comment)
        return kanbanError('Comment not found.', 404)

      const updated = await refreshModel(await comment.update({ body }))
      const userId = modelNullableNumber(updated, 'userId', 'user_id')
      const author = userId === null ? null : await User.find(userId)

      return { comment: cardCommentResponse(updated, author) }
    }
    catch (error) {
      return kanbanActionError(error, 'CardCommentUpdateAction')
    }
  },
})
