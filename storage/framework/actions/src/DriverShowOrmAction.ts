import type { DriverRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Driver Show',
  description: 'Driver Show ORM Action',
  method: 'GET',
  async handle(request: DriverRequestType) {
    const id = request.getParam('id')

    const model = await Driver.findOrFail(Number(id))

    return response.json(model)
  },
})
