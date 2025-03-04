import type { CustomerRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Customer Update',
  description: 'Customer Update ORM Action',
  method: 'PATCH',
  async handle(request: CustomerRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await Customer.findOrFail(Number(id))

    const result = model.update(request.all())

    return response.json(result)
  },
})
