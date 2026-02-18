import { Action } from '@stacksjs/actions'

import { posts } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Post Destroy',
  description: 'Post Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')

    await posts.destroy(id)

    return response.json({ message: 'Post deleted!' })
  },
})
