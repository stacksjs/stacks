import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingZone Index',
  description: 'ShippingZone Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await shippings.zones.fetchAll()

    return response.json(results)
  },
})
