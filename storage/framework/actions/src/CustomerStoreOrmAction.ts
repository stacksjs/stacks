import type { CustomerRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Customer Store',
  description: 'Customer Store ORM Action',
  method: 'POST',
  async handle(request: CustomerRequestType) {
    await request.validate()
    const model = await Customer.create(request.all())

    return response.json(model)
  },
})
