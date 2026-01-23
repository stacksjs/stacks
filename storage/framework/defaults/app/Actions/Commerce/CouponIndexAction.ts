import { Action } from '@stacksjs/actions'

import { coupons } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Coupon Index',
  description: 'Coupon Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await coupons.fetchAll()

    return response.json(results)
  },
})
