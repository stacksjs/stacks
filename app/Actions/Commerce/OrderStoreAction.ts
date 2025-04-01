import type { OrderRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Order Store',
  description: 'Order Store ORM Action',
  method: 'POST',
  async handle(request: OrderRequestType) {
    await request.validate()
    const model = await Order.create(request.all())

    return response.json(model)
  },
})
