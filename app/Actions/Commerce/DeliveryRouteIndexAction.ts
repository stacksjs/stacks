import { Action } from '@stacksjs/actions'

import { deliveryRoutes } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DeliveryRoute Index',
  description: 'DeliveryRoute Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await deliveryRoutes.fetchAll()

    return response.json(results)
  },
})
