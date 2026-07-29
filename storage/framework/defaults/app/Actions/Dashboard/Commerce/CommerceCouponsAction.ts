import { Action } from '@stacksjs/actions'
import { Coupon } from '@stacksjs/orm'
import { normalizeCouponRecord, summarizeCoupons } from './coupon-records'

export default new Action({
  name: 'CommerceCouponsAction',
  description: 'Returns persisted Coupon records for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const coupons = await Coupon.orderByDesc('id').limit(500).get()
    const records = coupons.map(normalizeCouponRecord)
    return {
      records,
      summary: summarizeCoupons(records),
    }
  },
})
