import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingMethod Index',
  description: 'ShippingMethod Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await shippings.methods.fetchAll()

    return response.json(results)
  },
})
