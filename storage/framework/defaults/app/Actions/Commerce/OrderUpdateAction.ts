import { Action } from '@stacksjs/actions'

import { orders } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Order Update',
  description: 'Order Update ORM Action',
  method: 'PATCH',
  model: Order,
  async handle(request: RequestInstance) {
    await request.validate()

    const id = request.getParam('id')
    const data = toSnakeCaseKeys(request.all())

    const model = await orders.update(id, data)

    return response.json(model)
  },
})
