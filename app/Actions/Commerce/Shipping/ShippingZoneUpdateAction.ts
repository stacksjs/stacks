import type { ShippingZoneRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingZone Update',
  description: 'ShippingZone Update ORM Action',
  method: 'PATCH',
  async handle(request: ShippingZoneRequestType) {
    const id = request.getParam('id')
    const model = await shippings.zones.update(id, request)

    return response.json(model)
  },
})
