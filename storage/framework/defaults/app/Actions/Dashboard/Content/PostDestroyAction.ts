import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

/**
 * `DELETE /api/dashboard/posts/{id}` — deletes a CMS post from the dashboard.
 *
 * Detaches the native category and tag relations before removing the post so
 * no pivot rows are orphaned.
 */
export default new Action({
  name: 'PostDestroyAction',
  description: 'Deletes a CMS post from the dashboard.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))

    if (!Number.isInteger(id) || id <= 0)
      return response.json({ message: 'A valid post id is required.' }, 422)

    const post = await Post.find(id)

    if (!post)
      return response.json({ message: 'Post not found.' }, 404)

    await Promise.all([
      post.categories().detach(),
      post.tags().detach(),
    ])
    await post.delete()

    return response.json({ message: 'Post deleted.', id })
  },
})
