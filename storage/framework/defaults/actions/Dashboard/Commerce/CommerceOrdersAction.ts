import { Action } from '@stacksjs/actions'
import { Order } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceOrders',
  description: 'Returns orders list with stats and filters.',
  method: 'GET',
  async handle() {
    const items = await Order.orderBy('created_at', 'desc').limit(50).get()
    const count = await Order.count()

    const stats = [
      { label: 'Total Orders', value: String(count) },
      { label: 'Pending', value: '-' },
      { label: 'Processing', value: '-' },
      { label: 'Completed', value: '-' },
    ]

    const filters = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled']

    return {
      orders: items.map(i => i.toJSON()),
      stats,
      filters,
    }
  },
})
