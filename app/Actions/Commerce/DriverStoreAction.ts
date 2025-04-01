import type { DriverRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Driver Store',
  description: 'Driver Store ORM Action',
  method: 'POST',
  async handle(request: DriverRequestType) {
    await request.validate()
    const model = await Driver.create(request.all())

    return response.json(model)
  },
})
