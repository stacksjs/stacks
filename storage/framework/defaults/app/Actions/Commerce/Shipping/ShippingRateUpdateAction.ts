import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingRate Update',
  description: 'ShippingRate Update ORM Action',
  method: 'PATCH',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')

    const model = await shippings.rates.update(id, request)

    return response.json(model)
  },
})
