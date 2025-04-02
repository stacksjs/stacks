import type { DriverRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Driver Store',
  description: 'Driver Store ORM Action',
  method: 'POST',
  async handle(request: DriverRequestType) {
    const model = await shippings.drivers.store(request)

    return response.json(model)
  },
})
