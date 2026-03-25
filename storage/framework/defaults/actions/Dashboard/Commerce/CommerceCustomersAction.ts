import { Action } from '@stacksjs/actions'
import { Customer } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceCustomers',
  description: 'Returns customers list with stats.',
  method: 'GET',
  async handle() {
    const items = await Customer.orderBy('created_at', 'desc').limit(50).get()
    const count = await Customer.count()

    const stats = [
      { label: 'Total Customers', value: String(count) },
      { label: 'Active', value: '-' },
      { label: 'VIP', value: '-' },
      { label: 'Avg Lifetime Value', value: '-' },
    ]

    return {
      customers: items.map(i => i.toJSON()),
      stats,
    }
  },
})
