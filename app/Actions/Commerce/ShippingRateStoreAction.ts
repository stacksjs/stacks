import type { ShippingRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingRate Store',
  description: 'ShippingRate Store ORM Action',
  method: 'POST',
  async handle(request: ShippingRateRequestType) {
    await request.validate()
    const model = await ShippingRate.create(request.all())

    return response.json(model)
  },
})
