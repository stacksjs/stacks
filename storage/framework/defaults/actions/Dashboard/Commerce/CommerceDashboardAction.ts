import { Action } from '@stacksjs/actions'
import { Order, Product } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceDashboard',
  description: 'Returns commerce dashboard stats, recent orders, and top products.',
  method: 'GET',
  async handle() {
    const recentOrders = await Order.orderBy('created_at', 'desc').limit(10).get()
    const orderCount = await Order.count()
    const topProducts = await Product.orderBy('created_at', 'desc').limit(10).get()

    const stats = [
      { label: 'Revenue Today', value: '-', change: '' },
      { label: 'Orders', value: String(orderCount), change: '' },
      { label: 'Avg Order Value', value: '-', change: '' },
      { label: 'Conversion Rate', value: '-', change: '' },
    ]

    return {
      stats,
      recentOrders: recentOrders.map(i => i.toJSON()),
      topProducts: topProducts.map(i => i.toJSON()),
    }
  },
})
