import { Action } from '@stacksjs/actions'
import { Category } from '@stacksjs/orm'

export default new Action({
  name: 'CategoryIndexAction',
  description: 'Returns categories data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await Category.orderBy('created_at', 'desc').limit(50).get()

    return {
      categories: items.map(i => i.toJSON()),
    }
  },
})
