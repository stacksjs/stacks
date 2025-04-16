import type { CustomerRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { customers } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Customer Update',
  description: 'Customer Update ORM Action',
  method: 'PATCH',
  async handle(request: CustomerRequestType) {
    await request.validate()

    const id = request.getParam('id')

    const data = {
      name: request.get('name'),
      email: request.get('email'),
      phone: request.get('phone'),
      status: request.get('status'),
    }

    const result = await customers.update(id, data)

    return response.json(result)
  },
})
