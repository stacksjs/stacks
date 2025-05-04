import type { PostRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { authors, posts } from '@stacksjs/cms'
import { response } from '@stacksjs/router'
import { findOrCreateMany } from '../../../storage/framework/core/cms/src/tags/store'

export default new Action({
  name: 'Post Store',
  description: 'Post Store ORM Action',
  method: 'POST',
  requestFile: 'PostRequest',
  async handle(request: PostRequestType) {
    await request.validate()

    const categoryIds = JSON.parse(request.get('category_ids')) as number[]
    const tagNames = JSON.parse(request.get('tag_names')) as string[]

    const author = await authors.findOrCreate({
      name: request.get('author_name'),
      email: request.get('author_email'),
    })

    // Process tags using the dedicated tag management function
    const tagIds = await findOrCreateMany(tagNames, 'posts')

    const data = {
      author_id: author.id,
      title: request.get('title'),
      content: request.get('content'),
      status: request.get('status'),
      poster: request.get('poster'),
      views: 0,
      published_at: Date.now(),
    }

    const model = await posts.store(data)

    await posts.attach(model.id, 'categorizable_models', categoryIds)
    await posts.attach(model.id, 'taggable_models', tagIds)

    return response.json(model)
  },
})
