import { Action } from '@stacksjs/actions'
import { Coupon, Product } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { normalizeCouponRecord, summarizeCoupons } from './coupon-records'
import { commerceIdentifier, commerceValue } from './commerce-record'

export default new Action({
  name: 'CommerceCouponsAction',
  description: 'Returns persisted Coupon records for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const [coupons, products] = await Promise.all([
        Coupon.orderByDesc('id').limit(500).get(),
        Product.orderBy('id', 'asc').limit(500).get(),
      ])
      const productIds = new Set(products.map(product =>
        commerceIdentifier(commerceValue(product, 'id', 'uuid'), 'Product'),
      ))
      const records = coupons.map(coupon => normalizeCouponRecord(coupon, productIds))
      return {
        records,
        summary: summarizeCoupons(records),
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Coupon records could not be read.',
      }, 503)
    }
  },
})
