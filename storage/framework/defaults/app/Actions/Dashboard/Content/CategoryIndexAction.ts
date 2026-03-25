import { Action } from '@stacksjs/actions'
import { Category } from '@stacksjs/orm'

export default new Action({
  name: 'CategoryIndexAction',
  description: 'Returns categories data for the dashboard.',
  method: 'GET',
  async handle() {
    try {
      const allCategories = await Category.all()

      const categories = allCategories.map(c => ({
        id: Number(c.get('id')),
        name: String(c.get('name') || ''),
        slug: String(c.get('slug') || ''),
        description: String(c.get('description') || ''),
        parentId: c.get('parent_id') || null,
        postCount: Number(c.get('post_count') || 0),
      }))

      return { categories }
    }
    catch {
      return { categories: [] }
    }
  },
})
