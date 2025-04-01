import type { DriverRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { drivers } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Driver Update',
  description: 'Driver Update ORM Action',
  method: 'PUT',
  async handle(request: DriverRequestType) {
    await request.validate()
    const id = request.getParam('id')

    const model = await drivers.update(Number(id), request)

    return response.json(model)
  },
})
