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

    const model = await coupons.update(id, request)

    return response.json(model)
  },
})
