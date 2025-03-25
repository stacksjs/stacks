import type { DeliveryRouteRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DeliveryRoute Store',
  description: 'DeliveryRoute Store ORM Action',
  method: 'POST',
  async handle(request: DeliveryRouteRequestType) {
    await request.validate()
    const model = await DeliveryRoute.create(request.all())

    return response.json(model)
  },
})
