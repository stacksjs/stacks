import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingZone Index',
  description: 'ShippingZone Index ORM Action',
  method: 'GET',
  async handle() {
    const results = ShippingZone.all()

    return response.json(results)
  },
})
