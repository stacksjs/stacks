import type { CouponRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { coupons } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Coupon Store',
  description: 'Coupon Store ORM Action',
  method: 'POST',
  requestFile: 'CouponRequest',
  async handle(request: CouponRequestType) {
    await request.validate()

    const data = request.all()

    const model = await coupons.store(data)

    return response.json(model)
  },
})
