import type { PostRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { posts } from '@stacksjs/cms'
import { formatDate } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { categories } from 'commerce/src/products'
import { findOrCreateMany } from '../../../storage/framework/core/cms/src/taggables/store'

export default new Action({
  name: 'Post Update',
  description: 'Post Update ORM Action',
  method: 'PATCH',
  model: 'Post',
  async handle(request: PostRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const categoryName = request.get('category')
    const tagNames = request.get('tags') as string[]

    // Update or create category if provided
    if (categoryName) {
      const category = await categories.findOrCreateByName({
        name: categoryName,
        categorizable_type: 'posts',
      })
      await posts.sync(id, 'categorizable_models', [category.id])
    }

    // Update tags if provided
    if (tagNames) {
      const tagIds = await findOrCreateMany(tagNames, 'posts')
      await posts.sync(id, 'taggable_models', tagIds)
    }

    const data = {
      title: request.get('title'),
      excerpt: request.get('excerpt'),
      content: request.get('content'),
      status: request.get('status'),
      poster: request.get('poster'),
      updated_at: formatDate(new Date()),
    }

    const model = await posts.update(id, data)

    return response.json(model)
  },
})
