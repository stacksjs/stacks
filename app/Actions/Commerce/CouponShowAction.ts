import type { CouponRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Coupon Show',
  description: 'Coupon Show ORM Action',
  method: 'GET',
  async handle(request: CouponRequestType) {
    const id = request.getParam('id')

    const model = await Coupon.findOrFail(Number(id))

    return response.json(model)
  },
})
