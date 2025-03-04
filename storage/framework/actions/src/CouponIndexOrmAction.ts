import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Coupon Index',
  description: 'Coupon Index ORM Action',
  method: 'GET',
  async handle() {
    const results = Coupon.all()

    return response.json(results)
  },
})
