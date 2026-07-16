import type { RequestInstance } from '@stacksjs/types'
import { Action, BlogAdminError, saveBlogPost } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { blogPayload } from './payload'

export default new Action({
  name: 'Blog Update',
  description: 'Updates a markdown post in content/blog, renaming the file when the slug changes.',
  method: 'PATCH',
  async handle(request: RequestInstance) {
    try {
      const originalSlug = String(request.getParam('slug') ?? '')

      return response.json(saveBlogPost(blogPayload(request, originalSlug)))
    }
    catch (error) {
      if (error instanceof BlogAdminError)
        return response.json({ message: error.message }, error.status)

      throw error
    }
  },
})
