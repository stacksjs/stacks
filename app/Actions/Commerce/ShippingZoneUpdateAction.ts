import type { ShippingZoneRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingZone Update',
  description: 'ShippingZone Update ORM Action',
  method: 'PATCH',
  async handle(request: ShippingZoneRequestType) {
    await request.validate()

    const id = request.getParam<number>('id')
    const model = await ShippingZone.findOrFail(id)

    const result = model.update(request.all())

    return response.json(result)
  },
})
