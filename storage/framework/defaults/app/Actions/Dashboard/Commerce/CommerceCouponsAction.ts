import { Action } from '@stacksjs/actions'
import { Coupon } from '@stacksjs/orm'

export default new Action({
  name: 'CommerceCoupons',
  description: 'Returns coupons list with stats.',
  method: 'GET',
  async handle() {
    try {
      const allCoupons = await Coupon.orderByDesc('id').limit(50).get()

      const coupons = allCoupons.map(r => ({
        code: String(r.get('code') || ''),
        type: String(r.get('type') || ''),
        value: String(r.get('value') || ''),
        uses: Number(r.get('uses') || 0),
        limit: r.get('usage_limit') || null,
        expires: String(r.get('expires_at') || 'Never'),
        status: String(r.get('status') || 'active'),
      }))

      const totalCoupons = coupons.length
      const activeCount = coupons.filter(c => c.status === 'active').length
      const totalUses = coupons.reduce((s, c) => s + c.uses, 0)

      const stats = [
        { label: 'Active Coupons', value: String(activeCount) },
        { label: 'Total Uses', value: String(totalUses) },
        { label: 'Revenue Impact', value: '-' },
        { label: 'Avg Discount', value: '-' },
      ]

      return { coupons, stats }
    }
    catch {
      return {
        coupons: [],
        stats: [
          { label: 'Active Coupons', value: '0' },
          { label: 'Total Uses', value: '0' },
          { label: 'Revenue Impact', value: '-' },
          { label: 'Avg Discount', value: '-' },
        ],
      }
    }
  },
})
