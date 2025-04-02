import type { ShippingZoneRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'ShippingZone Destroy',
  description: 'ShippingZone Destroy ORM Action',
  method: 'DELETE',
  async handle(request: ShippingZoneRequestType) {
    const id = request.getParam<number>('id')

    const model = await ShippingZone.findOrFail(id)

    model.delete()

    return 'Model deleted!'
  },
})
