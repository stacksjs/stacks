import { Action } from '@stacksjs/actions'
import { Payment, PaymentMethod } from '@stacksjs/orm'

export default new Action({
  name: 'CommercePayments',
  description: 'Returns payments list with stats and payment methods.',
  method: 'GET',
  async handle() {
    try {
      const [allPayments, allMethods] = await Promise.all([
        Payment.orderByDesc('id').limit(50).get(),
        PaymentMethod.all(),
      ])

      const payments = allPayments.map(r => ({
        id: r.get('id') ? `PAY-${r.get('id')}` : '',
        order: r.get('order_id') ? `ORD-${r.get('order_id')}` : '',
        amount: `$${Number(r.get('amount') || 0)}`,
        method: String(r.get('method') || r.get('payment_method') || ''),
        status: String(r.get('status') || ''),
        date: String(r.get('created_at') || ''),
      }))

      const completed = allPayments.filter(r => r.get('status') === 'completed')
      const totalRev = completed.reduce((s, r) => s + (Number(r.get('amount')) || 0), 0)
      const pending = allPayments.filter(r => r.get('status') === 'pending').reduce((s, r) => s + (Number(r.get('amount')) || 0), 0)
      const refunded = allPayments.filter(r => r.get('status') === 'refunded').reduce((s, r) => s + (Number(r.get('amount')) || 0), 0)
      const failed = allPayments.filter(r => r.get('status') === 'failed').length

      const stats = [
        { label: 'Total Revenue', value: `$${totalRev.toLocaleString()}` },
        { label: 'Pending', value: `$${pending.toLocaleString()}` },
        { label: 'Refunded', value: `$${refunded.toLocaleString()}` },
        { label: 'Failed', value: String(failed) },
      ]

      const paymentMethods = allMethods.map(m => ({
        name: String(m.get('name') || m.get('type') || ''),
        provider: String(m.get('provider') || ''),
        status: String(m.get('status') || 'active'),
        volume: '-',
      }))

      return { payments, stats, paymentMethods }
    }
    catch {
      return {
        payments: [],
        stats: [
          { label: 'Total Revenue', value: '$0' },
          { label: 'Pending', value: '$0' },
          { label: 'Refunded', value: '$0' },
          { label: 'Failed', value: '0' },
        ],
        paymentMethods: [],
      }
    }
  },
})
