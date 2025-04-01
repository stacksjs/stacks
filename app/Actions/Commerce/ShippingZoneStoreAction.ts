import type { ShippingZoneRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingZone Store',
  description: 'ShippingZone Store ORM Action',
  method: 'POST',
  async handle(request: ShippingZoneRequestType) {
    await request.validate()
    const model = await ShippingZone.create(request.all())

    return response.json(model)
  },
})
