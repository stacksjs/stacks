import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { findPost, invalidPostContent, invalidPostReference, postPayload, publishedAtFor, timestamp } from './post-input'

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

    const invalidReference = await invalidPostReference(payload)
    if (invalidReference)
      return response.json({ message: invalidReference }, 422)

    const existing = await db
      .selectFrom('posts')
      .select(['id', 'published_at'])
      .where('id', '=', id)
      .executeTakeFirst() as { id: number, published_at: string | null } | undefined

    if (!existing)
      return response.json({ message: 'Post not found.' }, 404)

    await db
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

    const post = await Post.find(id)

    if (!post)
      return response.json({ message: 'Updated post could not be loaded.' }, 500)

    await Promise.all([
      post.categories().sync(payload.categoryIds),
      post.tags().sync(payload.tagIds),
    ])

    return response.json(await findPost(id))
  },
})
