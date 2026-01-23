import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Driver Index',
  description: 'Driver Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await shippings.drivers.fetchAll()

    return response.json(results)
  },
})
