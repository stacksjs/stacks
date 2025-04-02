import type { DeliveryRouteRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { deliveryRoutes } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DeliveryRoute Update',
  description: 'DeliveryRoute Update ORM Action',
  method: 'PUT',
  async handle(request: DeliveryRouteRequestType) {
    const id = request.getParam<number>('id')

    const model = await deliveryRoutes.update(id, request)

    return response.json(model)
  },
})
