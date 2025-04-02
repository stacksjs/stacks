import type { ShippingMethodRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingMethod Show',
  description: 'ShippingMethod Show ORM Action',
  method: 'GET',
  async handle(request: ShippingMethodRequestType) {
    const id = request.getParam<number>('id')

    const model = await ShippingMethod.findOrFail(id)

    return response.json(model)
  },
})
