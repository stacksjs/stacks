import type { ShippingRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingRate Show',
  description: 'ShippingRate Show ORM Action',
  method: 'GET',
  async handle(request: ShippingRateRequestType) {
    const id = request.getParam<number>('id')

    const model = await ShippingRate.findOrFail(id)

    return response.json(model)
  },
})
