import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingRate Index',
  description: 'ShippingRate Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await shippings.rates.fetchAll()

    return response.json(results)
  },
})
