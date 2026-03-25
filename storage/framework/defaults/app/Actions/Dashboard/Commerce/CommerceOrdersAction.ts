import { Action } from '@stacksjs/actions'
import { Order } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceOrders',
  description: 'Returns orders list with stats and filters.',
  method: 'GET',
  async handle() {
    const filters = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled']

    try {
      const allOrders = await Order.orderBy('created_at', 'desc').get()

      const orders = allOrders.map(o => ({
        id: `ORD-${String(o.get('id')).padStart(4, '0')}`,
        customer: String(o.get('customer_name') || 'Guest'),
        items: Number(o.get('item_count') || 1),
        total: `$${(Number(o.get('total_amount')) || 0).toFixed(2)}`,
        status: String(o.get('status') || 'pending'),
        payment: o.get('status') === 'completed' ? 'paid' : o.get('status') === 'cancelled' ? 'refunded' : 'pending',
        date: o.get('created_at') ? String(o.get('created_at')).split('T')[0] : 'N/A',
      }))

      const totalOrders = orders.length
      const pendingOrders = orders.filter(o => o.status === 'pending').length
      const processingOrders = orders.filter(o => o.status === 'processing').length
      const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'shipped' || o.status === 'delivered').length

      const stats = [
        { label: 'Total Orders', value: String(totalOrders) },
        { label: 'Pending', value: String(pendingOrders) },
        { label: 'Processing', value: String(processingOrders) },
        { label: 'Completed', value: String(completedOrders) },
      ]

      return { orders, stats, filters }
    }
    catch {
      return {
        orders: [],
        stats: [
          { label: 'Total Orders', value: '0' },
          { label: 'Pending', value: '0' },
          { label: 'Processing', value: '0' },
          { label: 'Completed', value: '0' },
        ],
        filters,
      }
    }
  },
})
