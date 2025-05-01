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
    
    const data = {
      title: request.get('title'),
      body: request.get('body'),
      status: request.get('status'),
      poster: request.get('poster'),
    }
    
    const model = await posts.update(id, data)

    return response.json(model)
  },
})
