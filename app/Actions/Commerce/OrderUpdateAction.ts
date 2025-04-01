import type { OrderRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { orders } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Order Update',
  description: 'Order Update ORM Action',
  method: 'PUT',
  async handle(request: OrderRequestType) {
    const id = request.getParam('id')

    const model = await orders.update(Number(id), request)

    return response.json(model)
  },
})
