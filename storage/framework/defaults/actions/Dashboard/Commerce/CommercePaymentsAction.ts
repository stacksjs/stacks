import { Action } from '@stacksjs/actions'
import { Payment, PaymentMethod } from '@stacksjs/orm'

export default new Action({
  name: 'CommercePayments',
  description: 'Returns payments list with stats and payment methods.',
  method: 'GET',
  async handle() {
    const items = await Payment.orderBy('created_at', 'desc').limit(50).get()
    const count = await Payment.count()
    const methods = await PaymentMethod.orderBy('created_at', 'desc').limit(50).get()

    const stats = [
      { label: 'Total Payments', value: String(count) },
      { label: 'Pending', value: '-' },
      { label: 'Refunded', value: '-' },
      { label: 'Failed', value: '-' },
    ]

    return {
      payments: items.map(i => i.toJSON()),
      stats,
      paymentMethods: methods.map(i => i.toJSON()),
    }
  },
})
