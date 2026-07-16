import type { RequestInstance } from '@stacksjs/types'
import { Action, BlogAdminError, getBlogPost } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Blog Show',
  description: 'Returns one markdown post from content/blog, body included.',
  method: 'GET',
  async handle(request: RequestInstance) {
    try {
      const post = getBlogPost(String(request.getParam('slug') ?? ''))

      if (!post)
        return response.json({ message: 'Post not found.' }, 404)

      return response.json(post)
    }
    catch (error) {
      if (error instanceof BlogAdminError)
        return response.json({ message: error.message }, error.status)

      throw error
    }
  },
})
