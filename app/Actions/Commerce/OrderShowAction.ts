import type { OrderRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { orders } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Order Show',
  description: 'Order Show ORM Action',
  method: 'GET',
  async handle(request: OrderRequestType) {
    const id = request.getParam('id')

    const model = await orders.fetchById(id)

    return response.json(model)
  },
})
