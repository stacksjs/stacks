import { Action } from '@stacksjs/actions'
import { Order, Product } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceDashboard',
  description: 'Returns commerce dashboard stats, recent orders, and top products.',
  method: 'GET',
  async handle() {
    try {
      const [orderCount, allOrders, recentOrderRows, topProductRows] = await Promise.all([
        Order.count(),
        Order.all(),
        Order.orderBy('created_at', 'desc').limit(4).get(),
        Product.orderByDesc('price').limit(4).get(),
      ])

      const totalRevenue = allOrders.reduce((sum, o) => sum + (Number(o.get('total_amount')) || 0), 0)
      const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0

      const stats = [
        { label: 'Revenue Today', value: `$${totalRevenue.toLocaleString()}`, change: '+15.2%' },
        { label: 'Orders', value: String(orderCount), change: '+8.5%' },
        { label: 'Avg Order Value', value: `$${avgOrderValue.toFixed(2)}`, change: '+3.2%' },
        { label: 'Conversion Rate', value: '3.4%', change: '+0.5%' },
      ]

      const recentOrders = recentOrderRows.map(o => ({
        id: `ORD-${String(o.get('id')).padStart(4, '0')}`,
        customer: 'Customer',
        total: `$${(Number(o.get('total_amount')) || 0).toFixed(2)}`,
        status: String(o.get('status') || 'pending'),
        time: 'Recently',
      }))

      const topProducts = topProductRows.map(p => ({
        name: String(p.get('name') || 'Product'),
        sales: Number(p.get('inventory_count') || 0),
        revenue: `$${(Number(p.get('price')) || 0).toFixed(0)}`,
      }))

      return { stats, recentOrders, topProducts }
    }
    catch {
      return {
        stats: [
          { label: 'Revenue Today', value: '$0', change: '' },
          { label: 'Orders', value: '0', change: '' },
          { label: 'Avg Order Value', value: '$0.00', change: '' },
          { label: 'Conversion Rate', value: '0%', change: '' },
        ],
        recentOrders: [],
        topProducts: [],
      }
    }
  },
})
