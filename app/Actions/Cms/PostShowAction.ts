import type { PostRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { posts } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Post Show',
  description: 'Post Show ORM Action',
  method: 'GET',
  async handle(request: PostRequestType) {
    const id = request.getParam('id')

    const model = await posts.fetchById(id)

    return response.json(model)
  },
})
