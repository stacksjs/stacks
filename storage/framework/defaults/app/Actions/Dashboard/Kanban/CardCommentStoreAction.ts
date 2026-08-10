import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Card, CardComment } from '@stacksjs/orm'
import { cardCommentResponse } from './kanban-comment'
import { refreshModel } from './kanban-model'
import { kanbanActionError, kanbanError } from './kanban-response'

interface CommentInput {
  body?: unknown
}

/**
 * `POST /api/dashboard/kanban/cards/:id/comments`.
 *
 * Appends a comment to a card. Stamps `user_id` from the request's
 * authenticated user when available; leaves it null on the no-auth
 * dev dashboard so the surface stays usable locally.
 *
 * Writes through the model so generated API validation, timestamps, and
 * observers stay aligned with the rest of the application.
 */
export default new Action({
  name: 'Kanban Card Comment Store',
  description: 'Adds a comment to a card.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance<CommentInput>) {
    const cardId = Number(request.getParam('id'))
    if (!Number.isFinite(cardId) || cardId <= 0)
      return kanbanError('Invalid card id', 400)

    const body = request.all()
    const text = typeof body.body === 'string' ? body.body.trim() : ''
    if (!text || text.length > 10000)
      return kanbanError('`body` is required and must be 1-10000 characters.', 400)

    try {
      const card = await Card.find(cardId)
      if (!card)
        return kanbanError('Card not found.', 404)

      const user = await request.user()
      const userId = user && Number.isInteger(Number(user.id)) ? Number(user.id) : null
      const comment = await refreshModel(await CardComment.create({
        cardId,
        userId,
        body: text,
      }))

      return {
        comment: cardCommentResponse(comment, user),
      }
    }
    catch (err) {
      return kanbanActionError(err, 'CardCommentStoreAction')
    }
  },
})
