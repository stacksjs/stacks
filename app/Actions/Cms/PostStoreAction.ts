import type { PostRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { posts } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Post Store',
  description: 'Post Store ORM Action',
  method: 'POST',
  async handle(request: PostRequestType) {
    await request.validate()

    const data = {
      title: request.get('title'),
      body: request.get('body'),
      status: request.get('status'),
      user_id: request.get<number>('user_id'),
      author: request.get('author'),
      category: request.get('category'),
      poster: request.get('poster'),
    }

    const model = await posts.store(data)

    return response.json(model)
  },
})
