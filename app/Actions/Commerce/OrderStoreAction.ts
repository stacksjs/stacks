import type { OrderRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { orders } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Order Store',
  description: 'Order Store ORM Action',
  method: 'POST',
  async handle(request: OrderRequestType) {
    const model = await orders.store(request)

    return response.json(model)
  },
})
