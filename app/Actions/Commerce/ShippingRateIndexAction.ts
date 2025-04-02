import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { shipping } from '@stacksjs/commerce'

export default new Action({
  name: 'ShippingRate Index',
  description: 'ShippingRate Index ORM Action',
  method: 'GET',
  async handle() {
    const results = ShippingRate.all()

    return response.json(results)
  },
})
