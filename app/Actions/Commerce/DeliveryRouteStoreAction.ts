import type { DeliveryRouteRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { deliveryRoutes } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DeliveryRoute Store',
  description: 'DeliveryRoute Store ORM Action',
  method: 'POST',
  async handle(request: DeliveryRouteRequestType) {
    const model = await deliveryRoutes.store(request)

    return response.json(model)
  },
})
