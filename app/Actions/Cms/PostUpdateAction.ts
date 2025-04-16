import type { PostRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { posts } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Post Update',
  description: 'Post Update ORM Action',
  method: 'PATCH',
  async handle(request: PostRequestType) {
    const id = request.getParam('id')
    const model = await posts.update(id, request)

    return response.json(model)
  },
})
