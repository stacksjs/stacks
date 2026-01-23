import type { CustomerRequestType } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'

import { Action } from '@stacksjs/actions'

import { customers } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Customer Store',
  description: 'Customer Store ORM Action',
  method: 'POST',
  model: 'Customer',
  async handle(request: CustomerRequestType) {
    await request.validate()

    const data = {
      user_id: 1,
      name: request.get('name'),
      email: request.get('email'),
      phone: request.get('phone'),
      status: request.get('status'),
      uuid: randomUUIDv7(),
    }

    const model = await customers.store(data)

    return response.json(model)
  },
})
