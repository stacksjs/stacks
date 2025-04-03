import { Action } from '@stacksjs/actions'
import { orders } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Order Export',
  description: 'Order Export ORM Action',
  method: 'GET',
  async handle() {
    const results = await orders.exportOrders()

    return response.json(results)
  },
})
