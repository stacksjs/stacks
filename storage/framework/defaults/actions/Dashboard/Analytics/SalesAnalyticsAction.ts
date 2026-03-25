import { Action } from '@stacksjs/actions'
import { Order } from '@stacksjs/orm'

export default new Action({
  name: 'SalesAnalyticsAction',
  description: 'Returns sales analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    // TODO: replace with model query when available
    const orderCount = await Order.count()

    const stats = [
      { label: 'Total Sales', value: '-', change: '' },
      { label: 'Transactions', value: String(orderCount), change: '' },
      { label: 'Refunds', value: '-', change: '' },
      { label: 'Net Revenue', value: '-', change: '' },
    ]

    return {
      stats,
      dailySales: [],
      paymentMethods: [],
      salesTeam: [],
    }
  },
})
