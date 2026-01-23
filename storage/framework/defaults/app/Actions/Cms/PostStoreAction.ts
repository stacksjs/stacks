import type { PostRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { authors, posts } from '@stacksjs/cms'
import { response } from '@stacksjs/router'
import { categories } from 'commerce/src/products'
import { findOrCreateMany } from '../../../storage/framework/core/cms/src/taggables/store'

export default new Action({
  name: 'Post Store',
  description: 'Post Store ORM Action',
  method: 'POST',
  model: 'Post',
  async handle(request: PostRequestType) {
    await request.validate()

    const categoryName = request.get('category')
    const tagNames = request.get('tags') as string[]

    const category = await categories.findOrCreateByName({
      name: categoryName,
      categorizable_type: 'posts',
    })

    const author = await authors.findOrCreate({
      name: 'Current User',
      email: 'current@user.com',
    })

    // Process tags using the dedicated tag management function
    const tagIds = await findOrCreateMany(tagNames, 'posts')

    const data = {
      author_id: author.id,
      title: request.get('title'),
      excerpt: request.get('excerpt'),
      slug: request.get('slug'),
      content: request.get('content'),
      status: request.get('status'),
      poster: request.get('poster'),
      views: 0,
      published_at: Date.now(),
    }

    const model = await posts.store(data)

    await posts.attach(model.id, 'categorizable_models', [category.id])
    await posts.attach(model.id, 'taggable_models', tagIds)

    return response.json(model)
  },
})
