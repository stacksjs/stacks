import { Action } from '@stacksjs/actions'

import { orders } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Order Store',
  description: 'Order Store ORM Action',
  method: 'POST',
  model: Order,
  async handle(request: RequestInstance) {
    await request.validate()

    const data = toSnakeCaseKeys(request.all())

    const model = await orders.store(data)

    return response.json(model)
  },
})
