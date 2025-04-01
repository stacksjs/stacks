import { Action } from '@stacksjs/actions'
import { orders } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Order Index',
  description: 'Order Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await orders.fetchAll()

    return response.json(results)
  },
})
