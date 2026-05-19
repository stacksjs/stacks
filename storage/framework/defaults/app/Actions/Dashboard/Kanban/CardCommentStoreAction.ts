import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface CommentInput {
  body?: unknown
}

/**
 * `POST /api/dashboard/kanban/cards/:id/comments` (stacksjs/stacks#1846 Phase 3).
 *
 * Appends a comment to a card. Stamps `user_id` from the request's
 * authenticated user when available; leaves it null on the no-auth
 * dev dashboard so the surface stays usable locally.
 *
 * Returns the inserted row with denormalised author name/email for
 * the optimistic UI to render without a round-trip back through
 * `/cards/:id`.
 */
export default new Action({
  name: 'Kanban Card Comment Store',
  description: 'Adds a comment to a card.',
  method: 'POST',
  apiResponse: true,
  async handle(request) {
    const rawId = (request as any)?.params?.id ?? (request as any)?.param?.('id') ?? null
    const cardId = Number(rawId)
    if (!Number.isFinite(cardId) || cardId <= 0)
      return { error: 'Invalid card id', status: 400 }

    const body = (request as any).jsonBody as CommentInput | undefined ?? {}
    const text = typeof body.body === 'string' ? body.body.trim() : ''
    if (!text || text.length > 10000)
      return { error: '`body` is required and must be 1-10000 characters.', status: 400 }

    try {
      const cardRows = await db.unsafe('SELECT id FROM cards WHERE id = ? LIMIT 1', [cardId]).execute() as Array<{ id: number }>
      if (!cardRows?.length)
        return { error: 'Card not found.', status: 404 }

      const user = (request as any).user ?? (request as any)._authenticatedUser ?? null
      const userId = user && typeof user.id === 'number' ? user.id : null

      await db.insertInto('card_comments').values({
        card_id: cardId,
        user_id: userId,
        body: text,
      }).execute()

      // Pull the inserted row + author denormalisation. Ordered by id
      // DESC so the freshest matching row wins.
      const rows = await db.unsafe(
        `SELECT cc.id, cc.uuid, cc.user_id, cc.body, cc.created_at, cc.updated_at, u.name, u.email
        FROM card_comments cc
        LEFT JOIN users u ON u.id = cc.user_id
        WHERE cc.card_id = ? AND cc.body = ?
        ORDER BY cc.id DESC
        LIMIT 1`,
        [cardId, text],
      ).execute() as Array<{ id: number, uuid: string | null, user_id: number | null, body: string, created_at: string | null, updated_at: string | null, name: string | null, email: string | null }>
      const r = rows?.[0]
      if (!r)
        return { error: 'Comment insert succeeded but follow-up read returned nothing.', status: 500 }

      return {
        comment: {
          id: r.id,
          uuid: r.uuid,
          userId: r.user_id,
          body: r.body,
          authorName: r.name,
          authorEmail: r.email,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        },
      }
    }
    catch (err) {
      console.error('[dashboard/kanban] CardCommentStoreAction failed:', err)
      return { error: err instanceof Error ? err.message : 'unknown error', status: 500 }
    }
  },
})
