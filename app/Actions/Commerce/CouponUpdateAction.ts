import type { CouponRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { coupons } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Coupon Update',
  description: 'Coupon Update ORM Action',
  method: 'PUT',
  async handle(request: CouponRequestType) {
    const id = request.getParam('id')

    const data = {
      code: request.get('code'),
      discount_type: request.get('discount_type'),
      discount_value: Number(request.get('discount_value')),
      expiry_date: request.get('expiry_date'),
    }

    const model = await coupons.update(id, data)

    return response.json(model)
  },
})
