import type { ShippingRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingRate Update',
  description: 'ShippingRate Update ORM Action',
  method: 'PATCH',
  async handle(request: ShippingRateRequestType) {
    await request.validate()

    const id = request.getParam<number>('id')
    const model = await ShippingRate.findOrFail(id)

    const result = model.update(request.all())

    return response.json(result)
  },
})
