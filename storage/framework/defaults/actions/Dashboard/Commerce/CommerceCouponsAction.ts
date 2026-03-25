import { Action } from '@stacksjs/actions'
import { Coupon } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceCoupons',
  description: 'Returns coupons list with stats.',
  method: 'GET',
  async handle() {
    const items = await Coupon.orderBy('created_at', 'desc').limit(50).get()
    const count = await Coupon.count()

    const stats = [
      { label: 'Active Coupons', value: String(count) },
      { label: 'Total Uses', value: '-' },
      { label: 'Revenue Impact', value: '-' },
      { label: 'Avg Discount', value: '-' },
    ]

    return {
      coupons: items.map(i => i.toJSON()),
      stats,
    }
  },
})
