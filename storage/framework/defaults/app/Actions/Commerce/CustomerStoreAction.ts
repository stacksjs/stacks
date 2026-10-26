import { randomUUIDv7 } from 'bun'

import { Action } from '@stacksjs/actions/runtime'

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

    // Only the fields the request sent: an absent one copied through
    // request.get() reached the query as undefined, which binds NULL and
    // erased the stored value or the column default (stacksjs/stacks#3010).
    const data = toSnakeCaseKeys({
      ...request.only(['name', 'email', 'phone', 'totalSpent', 'status', 'avatar']),
      uuid: randomUUIDv7(),
      ...(request.get('lastOrder') && { lastOrder: request.get('lastOrder') }),
    })

    const model = await customers.store(data)

    return response.json(model)
  },
})
