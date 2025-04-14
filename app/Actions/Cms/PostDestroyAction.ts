import type { PostRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Post } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Post Destroy',
  description: 'Post Destroy ORM Action',
  method: 'DELETE',
  async handle(request: PostRequestType) {
    const id = request.getParam('id')

    const model = await Post.findOrFail(id)

    model?.delete()

    return response.json({ message: 'Model deleted!' })
  },
})
