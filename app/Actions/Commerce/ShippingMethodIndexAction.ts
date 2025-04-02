import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { shipping } from '@stacksjs/commerce'
export default new Action({
  name: 'ShippingMethod Index',
  description: 'ShippingMethod Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await shipping.fetchAll()

    return response.json(results)
  },
})
