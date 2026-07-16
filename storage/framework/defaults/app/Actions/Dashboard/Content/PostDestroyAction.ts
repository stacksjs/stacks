import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'

/**
 * `DELETE /api/dashboard/posts/{id}` — deletes a CMS post from the dashboard.
 *
 * A plain row delete: this schema has no `categorizable_models` /
 * `taggable_models` pivot tables, so there is nothing to cascade to. (The
 * `@stacksjs/cms` `posts.destroy()` helper assumes those tables exist, which is
 * why this action talks to `db` directly instead.)
 */
export default new Action({
  name: 'PostDestroyAction',
  description: 'Deletes a CMS post from the dashboard.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))

    if (!Number.isInteger(id) || id <= 0)
      return response.json({ message: 'A valid post id is required.' }, 422)

    const existing = await db
      .selectFrom('posts')
      .select(['id'])
      .where('id', '=', id)
      .executeTakeFirst()

    if (!existing)
      return response.json({ message: 'Post not found.' }, 404)

    await db.deleteFrom('posts').where('id', '=', id).execute()

    return response.json({ message: 'Post deleted.', id })
  },
})
