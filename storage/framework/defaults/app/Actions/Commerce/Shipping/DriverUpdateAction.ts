import type { DriverRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Driver Update',
  description: 'Driver Update ORM Action',
  method: 'PUT',
  async handle(request: DriverRequestType) {
    const id = request.getParam('id')

    const model = await shippings.drivers.update(id, request)

    return response.json(model)
  },
})
