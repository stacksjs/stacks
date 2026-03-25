import { Action } from '@stacksjs/actions'
import { Transaction } from '@stacksjs/orm'

export default new Action({
  name: 'PosIndex',
  description: 'Returns POS terminals, today stats, and recent transactions.',
  method: 'GET',
  async handle() {
    const items = await Transaction.orderBy('created_at', 'desc').limit(50).get()
    const count = await Transaction.count()

    // TODO: replace with model query when Terminal model is available
    const terminals = [
      { id: 'POS-001', name: 'Main Register', location: 'Store Front', status: 'online', lastTransaction: '2m ago' },
      { id: 'POS-002', name: 'Back Register', location: 'Store Back', status: 'online', lastTransaction: '15m ago' },
      { id: 'POS-003', name: 'Mobile POS 1', location: 'Floor', status: 'online', lastTransaction: '5m ago' },
      { id: 'POS-004', name: 'Mobile POS 2', location: 'Floor', status: 'offline', lastTransaction: '2h ago' },
    ]

    const todayStats = [
      { label: 'Transactions', value: String(count) },
      { label: 'Total Sales', value: '-' },
      { label: 'Avg Transaction', value: '-' },
      { label: 'Cash/Card', value: '-' },
    ]

    return {
      terminals,
      todayStats,
      recentTransactions: items.map(i => i.toJSON()),
    }
  },
})
