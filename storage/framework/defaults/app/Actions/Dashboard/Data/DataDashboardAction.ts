import { Action } from '@stacksjs/actions'
import { User, Order, Product, Post } from '@stacksjs/orm'

export default new Action({
  name: 'DataDashboardAction',
  description: 'Returns database overview and statistics for the data dashboard.',
  method: 'GET',
  async handle() {
    try {
      const [userCount, orderCount, productCount, postCount] = await Promise.all([
        User.count(),
        Order.count(),
        Product.count(),
        Post.count(),
      ])

      const totalRecords = userCount + orderCount + productCount + postCount

      const tables = [
        { name: 'users', rows: String(userCount), size: '-', lastModified: '-' },
        { name: 'orders', rows: String(orderCount), size: '-', lastModified: '-' },
        { name: 'products', rows: String(productCount), size: '-', lastModified: '-' },
        { name: 'posts', rows: String(postCount), size: '-', lastModified: '-' },
      ]

      let dbSize = '-'
      try {
        const { statSync } = await import('node:fs')
        const { resolve } = await import('node:path')
        const dbPath = resolve(process.cwd(), 'database/stacks.sqlite')
        const fileStats = statSync(dbPath)
        const mb = (fileStats.size / (1024 * 1024)).toFixed(1)
        dbSize = `${mb} MB`
      }
      catch {
        // ignore
      }

      const stats = [
        { label: 'Total Records', value: totalRecords.toLocaleString(), change: '' },
        { label: 'Database Size', value: dbSize, change: '' },
        { label: 'Tables', value: String(tables.length), change: '' },
        { label: 'Query Rate', value: '-', change: '' },
      ]

      const recentQueries = [
        { query: 'SELECT * FROM users WHERE...', time: '-', source: 'API' },
        { query: 'INSERT INTO orders...', time: '-', source: 'Queue' },
        { query: 'UPDATE posts SET...', time: '-', source: 'Web' },
      ]

      return { stats, tables, recentQueries }
    }
    catch {
      return {
        stats: [
          { label: 'Total Records', value: '0', change: '' },
          { label: 'Database Size', value: '-', change: '' },
          { label: 'Tables', value: '0', change: '' },
          { label: 'Query Rate', value: '-', change: '' },
        ],
        tables: [],
        recentQueries: [],
      }
    }
  },
})
