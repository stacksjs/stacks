import type { CouponRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Coupon Store',
  description: 'Coupon Store ORM Action',
  method: 'POST',
  async handle(request: CouponRequestType) {
    await request.validate()
    const model = await Coupon.create(request.all())

    return response.json(model)
  },
})
