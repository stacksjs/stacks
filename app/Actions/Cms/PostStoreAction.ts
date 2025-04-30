import type { PostRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { authors, posts, postCategories } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Post Store',
  description: 'Post Store ORM Action',
  method: 'POST',
  async handle(request: PostRequestType) {
    await request.validate()

    const categoryIds = request.get('category_ids')

    const author = await authors.findOrCreate({
      name: request.get('author_name'),
      email: request.get('author_email'),
    })

    const data = {
      author_id: author.id,
      title: request.get('title'),
      body: request.get('body'),
      status: request.get('status'),
      poster: request.get('poster'),
      views: 0,
      published_at: Date.now(),
    }

    const model = await posts.store(data)

    return response.json(model)
  },
})
