import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Courier Index',
  description: 'Courier Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await shippings.couriers.fetchAll()

    return response.json(results)
  },
})
