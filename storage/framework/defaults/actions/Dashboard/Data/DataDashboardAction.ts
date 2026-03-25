import { Action } from '@stacksjs/actions'
import { User, Post, Order, Product } from '@stacksjs/orm'

export default new Action({
  name: 'DataDashboardAction',
  description: 'Returns database overview and statistics for the data dashboard.',
  method: 'GET',
  async handle() {
    const userCount = await User.count()
    const postCount = await Post.count()
    const orderCount = await Order.count()
    const productCount = await Product.count()
    const totalRecords = userCount + postCount + orderCount + productCount

    const tables = [
      { name: 'users', rows: String(userCount) },
      { name: 'posts', rows: String(postCount) },
      { name: 'orders', rows: String(orderCount) },
      { name: 'products', rows: String(productCount) },
    ]

    const stats = [
      { label: 'Total Records', value: String(totalRecords), change: '' },
      { label: 'Database Size', value: '-', change: '' },
      { label: 'Tables', value: String(tables.length), change: '' },
      { label: 'Query Rate', value: '-', change: '' },
    ]

    const recentQueries = [
      { query: 'SELECT * FROM users WHERE...', time: '12ms', source: 'API' },
      { query: 'INSERT INTO orders...', time: '8ms', source: 'Queue' },
      { query: 'UPDATE posts SET...', time: '15ms', source: 'Web' },
    ]

    return {
      stats,
      tables,
      recentQueries,
    }
  },
})
