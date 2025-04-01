import { Action } from '@stacksjs/actions'

import { digital } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DigitalDelivery Index',
  description: 'DigitalDelivery Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await digital.fetchAll()

    return response.json(results)
  },
})
