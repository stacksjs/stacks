import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { db } from '@stacksjs/database/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'

/**
 * `GET /api/dashboard/posts/{id}` — the body of one post, for the editor.
 *
 * The posts list carries a short preview of each body rather than the whole
 * article (stacksjs/stacks#3191), so the editor reads the body here when it
 * opens. Everything else it shows is already on the list row.
 */
export default new Action({
  name: 'PostShowAction',
  description: 'Returns the body of one CMS post for the dashboard editor.',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))

    if (!Number.isInteger(id) || id <= 0)
      return response.json({ message: 'A valid post id is required.' }, 422)

    try {
      const post = await db
        .selectFrom('posts')
        .select(['id', 'content'])
        .where('id', '=', id)
        .executeTakeFirst() as { id: number, content: string | null } | undefined

      if (!post)
        return response.json({ message: 'Post not found.' }, 404)

      return { id: Number(post.id), content: String(post.content || '') }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Post could not be loaded.', 'PostShowAction')
    }
  },
})
