import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { findPost, invalidPostContent, invalidPostReference, postPayload, publishedAtFor, syncPostRelations, timestamp } from './post-input'

/**
 * `PATCH /api/dashboard/posts/{id}` — updates a CMS post from the dashboard.
 *
 * The dashboard dialog always submits the full post, so every writable column
 * is replaced. `published_at` is derived from the incoming status rather than
 * accepted from the body — see `publishedAtFor`.
 */
export default new Action({
  name: 'PostUpdateAction',
  description: 'Updates a CMS post from the dashboard.',
  method: 'PATCH',
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))

    if (!Number.isInteger(id) || id <= 0)
      return response.json({ message: 'A valid post id is required.' }, 422)

    const payload = postPayload(request)

    const invalidContent = invalidPostContent(payload)
    if (invalidContent)
      return response.json({ message: invalidContent }, 422)

    try {
      const result = await transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        const invalidReference = await invalidPostReference(payload, trx)
        if (invalidReference)
          return { kind: 'invalid', message: invalidReference } as const

        const existing = await trx
          .selectFrom('posts')
          .select(['id', 'published_at'])
          .where('id', '=', id)
          .executeTakeFirst() as { id: number, published_at: string | null } | undefined

        if (!existing)
          return { kind: 'not-found' } as const

        await trx
          .updateTable('posts')
          .set({
            title: payload.title,
            excerpt: payload.excerpt,
            content: payload.content,
            poster: payload.poster,
            status: payload.status,
            author_id: payload.authorId,
            is_featured: payload.featured ? 1 : 0,
            published_at: publishedAtFor(payload.status, existing.published_at, timestamp()),
            updated_at: timestamp(),
          } as any)
          .where('id', '=', id)
          .execute()

        await syncPostRelations(trx, id, payload)

        const updated = await findPost(id, trx)
        if (!updated)
          throw new Error('Updated post could not be read back.')
        return { kind: 'updated', post: updated } as const
      })

      if (result.kind === 'invalid')
        return response.json({ message: result.message }, 422)
      if (result.kind === 'not-found')
        return response.json({ message: 'Post not found.' }, 404)

      return response.json(result.post)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Post could not be updated.', 'PostUpdateAction', 500)
    }
  },
})
