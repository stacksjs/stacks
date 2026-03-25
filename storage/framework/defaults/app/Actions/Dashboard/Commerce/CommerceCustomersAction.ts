import { Action } from '@stacksjs/actions'
import { Customer } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceCustomers',
  description: 'Returns customers list with stats.',
  method: 'GET',
  async handle() {
    try {
      const allCustomers = await Customer.all()
      const totalCustomers = await Customer.count()

      const customers = allCustomers.map(c => ({
        name: String(c.get('name') || 'Unknown'),
        email: String(c.get('email') || 'N/A'),
        orders: Number(c.get('order_count') || 0),
        spent: `$${(Number(c.get('total_spent') || 0)).toFixed(2)}`,
        lastOrder: 'Recently',
        status: (Number(c.get('total_spent') || 0)) > 500 ? 'vip' : (Number(c.get('order_count') || 0)) > 0 ? 'active' : 'inactive',
      }))

      const activeCustomers = customers.filter(c => c.status === 'active' || c.status === 'vip').length
      const vipCustomers = customers.filter(c => c.status === 'vip').length
      const totalSpent = allCustomers.reduce((sum, c) => sum + (Number(c.get('total_spent') || 0)), 0)
      const avgLifetimeValue = totalCustomers > 0 ? totalSpent / totalCustomers : 0

      const stats = [
        { label: 'Total Customers', value: String(totalCustomers) },
        { label: 'Active', value: String(activeCustomers) },
        { label: 'VIP', value: String(vipCustomers) },
        { label: 'Avg Lifetime Value', value: `$${avgLifetimeValue.toFixed(2)}` },
      ]

      return { customers, stats }
    }
    catch {
      return {
        customers: [],
        stats: [
          { label: 'Total Customers', value: '0' },
          { label: 'Active', value: '0' },
          { label: 'VIP', value: '0' },
          { label: 'Avg Lifetime Value', value: '$0.00' },
        ],
      }
    }
  },
})
