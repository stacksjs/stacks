import type { PostRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { posts } from '@stacksjs/cms'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Post Store',
  description: 'Post Store ORM Action',
  method: 'POST',
  async handle(request: PostRequestType) {
    const model = await posts.store(request)

    return response.json(model)
  },
})
