import type { PostRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'
import { posts } from '@stacksjs/cms'

export default new Action({
  name: 'Post Destroy',
  description: 'Post Destroy ORM Action',
  method: 'DELETE',
  async handle(request: PostRequestType) {
    const id = request.getParam('id')

    await posts.destroy(id)

    return response.json({ message: 'Post deleted!' })
  },
})
