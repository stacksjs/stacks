import type { OrderRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { orders } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Order Destroy',
  description: 'Order Destroy ORM Action',
  method: 'DELETE',
  async handle(request: OrderRequestType) {
    const id = request.getParam('id')

    await orders.destroy(id)

    return response.noContent()
  },
})
