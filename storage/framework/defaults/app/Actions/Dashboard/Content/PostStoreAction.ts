import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { randomUUIDv7 } from 'bun'
import { findPost, insertedId, postPayload, publishedAtFor, timestamp } from './post-input'

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

    if (!payload.title)
      return response.json({ message: 'Title is required.' }, 422)

    const now = timestamp()

    const result = await db
      .insertInto('posts')
      .values({
        uuid: randomUUIDv7(),
        title: payload.title,
        excerpt: payload.excerpt,
        content: payload.content,
        poster: payload.poster,
        status: payload.status,
        views: 0,
        published_at: publishedAtFor(payload.status, null, now),
        created_at: now,
        updated_at: now,
      } as any)
      .executeTakeFirst()

    const id = insertedId(result)

    if (!id)
      return response.json({ message: 'Could not create post.' }, 500)

    return response.json(await findPost(id), 201)
  },
})
