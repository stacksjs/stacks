import type { DeliveryRouteRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'DeliveryRoute Destroy',
  description: 'DeliveryRoute Destroy ORM Action',
  method: 'DELETE',
  async handle(request: DeliveryRouteRequestType) {
    const id = request.getParam('id')

    const model = await DeliveryRoute.findOrFail(Number(id))

    model.delete()

    return 'Model deleted!'
  },
})
