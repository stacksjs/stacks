import { Action } from '@stacksjs/actions'

import { drivers } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Driver Index',
  description: 'Driver Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await drivers.fetchAll()

    return response.json(results)
  },
})
