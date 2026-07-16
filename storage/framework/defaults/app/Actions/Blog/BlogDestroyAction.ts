import type { RequestInstance } from '@stacksjs/types'
import { Action, BlogAdminError, deleteBlogPost } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Blog Destroy',
  description: 'Deletes a markdown post from content/blog.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    try {
      const slug = String(request.getParam('slug') ?? '')

      if (!deleteBlogPost(slug))
        return response.json({ message: 'Post not found.' }, 404)

      return response.json({ message: 'Post deleted.', slug })
    }
    catch (error) {
      if (error instanceof BlogAdminError)
        return response.json({ message: error.message }, error.status)

      throw error
    }
  },
})
