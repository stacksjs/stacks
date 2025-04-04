import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DeliveryRoute Index',
  description: 'DeliveryRoute Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await shippings.routes.fetchAll()

    return response.json(results)
  },
})
