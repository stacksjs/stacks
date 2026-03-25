import { Action } from '@stacksjs/actions'
import { Product } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceProducts',
  description: 'Returns products list with stats and categories.',
  method: 'GET',
  async handle() {
    const items = await Product.orderBy('created_at', 'desc').limit(50).get()
    const count = await Product.count()

    const stats = [
      { label: 'Total Products', value: String(count) },
      { label: 'Active', value: '-' },
      { label: 'Low Stock', value: '-' },
      { label: 'Out of Stock', value: '-' },
    ]

    const categories = ['All Categories', 'Electronics', 'Clothing', 'Books', 'General']

    return {
      products: items.map(i => i.toJSON()),
      stats,
      categories,
    }
  },
})
