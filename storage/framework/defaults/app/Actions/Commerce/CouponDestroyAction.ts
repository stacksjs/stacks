import { Action } from '@stacksjs/actions'

import { coupons } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Coupon Destroy',
  description: 'Coupon Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')

    await coupons.deleteCoupon(id)

    return response.noContent()
  },
})
