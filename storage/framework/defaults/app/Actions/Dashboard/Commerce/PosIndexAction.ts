import { Action } from '@stacksjs/actions'
import { PrintDevice, Transaction } from '@stacksjs/orm'

export default new Action({
  name: 'PosIndex',
  description: 'Returns POS terminals, today stats, and recent transactions.',
  method: 'GET',
  async handle() {
    try {
      const [allDevices, allTransactions] = await Promise.all([
        PrintDevice.all(),
        Transaction.orderByDesc('id').limit(20).get(),
      ])

      const terminals = allDevices.map(d => ({
        id: `POS-${String(d.get('id')).padStart(3, '0')}`,
        name: String(d.get('name') || ''),
        location: String(d.get('location') || ''),
        status: String(d.get('status') || 'offline'),
        lastTransaction: String(d.get('last_used_at') || '-'),
      }))

      const recentTransactions = allTransactions.map(t => ({
        id: `TXN-${String(t.get('id')).padStart(4, '0')}`,
        terminal: String(t.get('device_id') ? `POS-${String(t.get('device_id')).padStart(3, '0')}` : '-'),
        amount: `$${(Number(t.get('amount')) || 0).toFixed(2)}`,
        method: String(t.get('method') || t.get('payment_method') || '-'),
        time: String(t.get('created_at') || '-'),
      }))

      const totalSales = allTransactions.reduce((s, t) => s + (Number(t.get('amount')) || 0), 0)
      const txnCount = allTransactions.length
      const avgTransaction = txnCount > 0 ? totalSales / txnCount : 0

      const todayStats = [
        { label: 'Transactions', value: String(txnCount) },
        { label: 'Total Sales', value: `$${totalSales.toLocaleString()}` },
        { label: 'Avg Transaction', value: `$${avgTransaction.toFixed(2)}` },
        { label: 'Cash/Card', value: '-' },
      ]

      return { terminals, todayStats, recentTransactions }
    }
    catch {
      return {
        terminals: [],
        todayStats: [
          { label: 'Transactions', value: '0' },
          { label: 'Total Sales', value: '$0' },
          { label: 'Avg Transaction', value: '$0.00' },
          { label: 'Cash/Card', value: '-' },
        ],
        recentTransactions: [],
      }
    }
  },
})
