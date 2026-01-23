import type { CouponRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { coupons } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Coupon Update',
  description: 'Coupon Update ORM Action',
  method: 'PATCH',
  async handle(request: CouponRequestType) {
    await request.validate()

    const id = request.getParam('id')

    const data = {
      code: request.get('code'),
      discount_type: request.get('discount_type'),
      discount_value: Number(request.get('discount_value')),
      status: request.get('status'),
      start_date: request.get('start_date'),
      end_date: request.get('end_date'),
      min_order_amount: Number(request.get('min_order_amount')),
      usage_limit: Number(request.get('usage_limit')),
    }

    const model = await coupons.update(id, data)

    return response.json(model)
  },
})
