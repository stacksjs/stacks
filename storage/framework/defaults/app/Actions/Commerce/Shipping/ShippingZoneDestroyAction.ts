import type { ShippingZoneRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingZone Destroy',
  description: 'ShippingZone Destroy ORM Action',
  method: 'DELETE',
  async handle(request: ShippingZoneRequestType) {
    const id = request.getParam('id')

    await shippings.zones.destroy(id)

    return response.json({ message: 'ShippingZone deleted successfully' })
  },
})
