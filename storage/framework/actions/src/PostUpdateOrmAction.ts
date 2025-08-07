import type { PostRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Post } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Post Update',
  description: 'Post Update ORM Action',
  method: 'PATCH',
  async handle(request: PostRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await Post.findOrFail(id)

    const result = model?.update(request.all())

    return response.json(result)
  },
})
