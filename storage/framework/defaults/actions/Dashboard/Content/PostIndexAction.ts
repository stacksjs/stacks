import { Action } from '@stacksjs/actions'
import { Post, Category, Tag } from '@stacksjs/orm'

export default new Action({
  name: 'PostIndexAction',
  description: 'Returns posts data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await Post.orderBy('created_at', 'desc').limit(50).get()
    const count = await Post.count()
    const categories = await Category.orderBy('created_at', 'desc').limit(50).get()
    const tags = await Tag.orderBy('created_at', 'desc').limit(50).get()

    return {
      posts: items.map(i => i.toJSON()),
      categories: categories.map(i => i.toJSON()),
      tags: tags.map(i => i.toJSON()),
      publishedCount: count,
      draftCount: 0,
      scheduledCount: 0,
    }
  },
})
