import type { DriverRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { drivers } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Driver Show',
  description: 'Driver Show ORM Action',
  method: 'GET',
  async handle(request: DriverRequestType) {
    const id = request.getParam<number>('id')

    const model = await drivers.fetchById(id)

    return response.json(model)
  },
})
