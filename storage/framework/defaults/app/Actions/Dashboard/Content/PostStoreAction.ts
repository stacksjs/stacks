import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { randomUUIDv7 } from 'bun'
import { dashboardOperationalError } from '../dashboard-response'
import { findPost, insertedId, invalidPostContent, invalidPostReference, postPayload, publishedAtFor, syncPostRelations, timestamp } from './post-input'

/**
 * `POST /api/dashboard/posts` — creates a CMS post from the dashboard.
 *
 * Deliberately does not reuse `Actions/Cms/PostStoreAction`: that action runs
 * the `Post` model validation, which rejects the empty `excerpt` / `poster`
 * that the dashboard dialog legitimately submits for a bare draft.
 */
export default new Action({
  name: 'PostStoreAction',
  description: 'Creates a CMS post from the dashboard.',
  method: 'POST',
  async handle(request: RequestInstance) {
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

        const now = timestamp()

        const insertResult = await trx
          .insertInto('posts')
          .values({
            uuid: randomUUIDv7(),
            title: payload.title,
            excerpt: payload.excerpt,
            content: payload.content,
            poster: payload.poster,
            status: payload.status,
            author_id: payload.authorId,
            is_featured: payload.featured ? 1 : 0,
            views: 0,
            published_at: publishedAtFor(payload.status, null, now),
            created_at: now,
            updated_at: now,
          } as any)
          .executeTakeFirst()

        const id = insertedId(insertResult)

        if (!id)
          throw new Error('Post insert did not return an id.')

        await syncPostRelations(trx, id, payload)

        const created = await findPost(id, trx)
        if (!created)
          throw new Error('Created post could not be read back.')
        return { kind: 'created', post: created } as const
      })

      if (result.kind === 'invalid')
        return response.json({ message: result.message }, 422)

      return response.json(result.post, 201)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Post could not be created.', 'PostStoreAction', 500)
    }
  },
})
