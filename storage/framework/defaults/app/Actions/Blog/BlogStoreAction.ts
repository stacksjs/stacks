import type { RequestInstance } from '@stacksjs/types'
import { Action, BlogAdminError, saveBlogPost } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { blogPayload } from './payload'

export default new Action({
  name: 'Blog Store',
  description: 'Creates a markdown post in content/blog.',
  method: 'POST',
  async handle(request: RequestInstance) {
    try {
      return response.json(saveBlogPost(blogPayload(request)), 201)
    }
    catch (error) {
      if (error instanceof BlogAdminError)
        return response.json({ message: error.message }, error.status)

      throw error
    }
  },
})
