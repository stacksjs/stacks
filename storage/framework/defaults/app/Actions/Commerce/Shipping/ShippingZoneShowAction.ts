import type { ShippingZoneRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingZone Show',
  description: 'ShippingZone Show ORM Action',
  method: 'GET',
  async handle(request: ShippingZoneRequestType) {
    const id = request.getParam('id')

    const model = await shippings.zones.fetchById(id)

    return response.json(model)
  },
})
