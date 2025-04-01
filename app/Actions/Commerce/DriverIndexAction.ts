import type { DriverRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { drivers } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Driver Index',
  description: 'Driver Index ORM Action',
  method: 'GET',
  async handle(request: DriverRequestType) {
    const results = await drivers.fetchAll()

    return response.json(results)
  },
})
