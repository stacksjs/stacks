import type { CouponRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { coupons } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Coupon Store',
  description: 'Coupon Store ORM Action',
  method: 'POST',
  async handle(request: CouponRequestType) {
    const model = await coupons.store(request)

    return response.json(model)
  },
})
