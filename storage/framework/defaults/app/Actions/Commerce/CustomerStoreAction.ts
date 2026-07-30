import { randomUUIDv7 } from 'bun'

import { Action } from '@stacksjs/actions'

import { customers } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Customer Store',
  description: 'Customer Store ORM Action',
  method: 'POST',
  model: Customer,
  async handle(request) {
    await request.validate()

    const data = toSnakeCaseKeys({
      name: request.get('name'),
      email: request.get('email'),
      phone: request.get('phone'),
      totalSpent: request.get('totalSpent'),
      status: request.get('status'),
      avatar: request.get('avatar'),
      uuid: randomUUIDv7(),
      ...(request.get('lastOrder') && { lastOrder: request.get('lastOrder') }),
    })

    const model = await customers.store(data)

    return response.json(model)
  },
})
