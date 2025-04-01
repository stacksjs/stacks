import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingMethod Index',
  description: 'ShippingMethod Index ORM Action',
  method: 'GET',
  async handle() {
    const results = ShippingMethod.all()

    return response.json(results)
  },
})
