import type { ShippingZoneRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingZone Store',
  description: 'ShippingZone Store ORM Action',
  method: 'POST',
  async handle(request: ShippingZoneRequestType) {
    const data = request.all()

    const model = await shippings.zones.store(data)

    return response.json(model)
  },
})
