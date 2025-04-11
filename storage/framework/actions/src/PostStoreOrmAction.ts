import type { PostRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Post } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Post Store',
  description: 'Post Store ORM Action',
  method: 'POST',
  async handle(request: PostRequestType) {
    await request.validate()
    const model = await Post.create(request.all())

    return response.json(model)
  },
})
