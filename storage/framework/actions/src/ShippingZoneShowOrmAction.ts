import type { ShippingZoneRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingZone Show',
  description: 'ShippingZone Show ORM Action',
  method: 'GET',
  async handle(request: ShippingZoneRequestType) {
    const id = request.getParam('id')

    const model = await ShippingZone.findOrFail(Number(id))

    return response.json(model)
  },
})
