import type { ShippingRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'ShippingRate Destroy',
  description: 'ShippingRate Destroy ORM Action',
  method: 'DELETE',
  async handle(request: ShippingRateRequestType) {
    const id = request.getParam('id')

    const model = await ShippingRate.findOrFail(Number(id))

    model.delete()

    return 'Model deleted!'
  },
})
