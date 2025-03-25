import type { DeliveryRouteRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DeliveryRoute Update',
  description: 'DeliveryRoute Update ORM Action',
  method: 'PATCH',
  async handle(request: DeliveryRouteRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await DeliveryRoute.findOrFail(Number(id))

    const result = model.update(request.all())

    return response.json(result)
  },
})
