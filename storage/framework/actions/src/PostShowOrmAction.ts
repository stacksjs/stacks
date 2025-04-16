import type { PostRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Post } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Post Show',
  description: 'Post Show ORM Action',
  method: 'GET',
  async handle(request: PostRequestType) {
    const id = request.getParam('id')

    const model = await Post.findOrFail(id)

    return response.json(model)
  },
})
