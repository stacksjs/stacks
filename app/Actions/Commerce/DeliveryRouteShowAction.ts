import type { DeliveryRouteRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { deliveryRoutes } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DeliveryRoute Show',
  description: 'DeliveryRoute Show ORM Action',
  method: 'GET',
  async handle(request: DeliveryRouteRequestType) {
    const id = request.getParam<number>('id')

    const model = await deliveryRoutes.fetchById(id)

    return response.json(model)
  },
})
