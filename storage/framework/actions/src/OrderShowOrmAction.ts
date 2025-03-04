import type { OrderRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Order Show',
  description: 'Order Show ORM Action',
  method: 'GET',
  async handle(request: OrderRequestType) {
    const id = request.getParam('id')

    const model = await Order.findOrFail(Number(id))

    return response.json(model)
  },
})
