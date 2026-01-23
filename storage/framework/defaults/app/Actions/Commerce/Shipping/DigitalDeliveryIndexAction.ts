import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DigitalDelivery Index',
  description: 'DigitalDelivery Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await shippings.digital.fetchAll()

    return response.json(results)
  },
})
