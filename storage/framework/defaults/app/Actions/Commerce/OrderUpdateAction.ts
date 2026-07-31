import { Action } from '@stacksjs/actions'

import { orders } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Order Update',
  description: 'Order Update ORM Action',
  method: 'PATCH',
  model: Order,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Order')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = toSnakeCaseKeys(request.all())

    const model = await orders.update(id, data)
    if (!model)
      return commerceNotFound('Order', id)

    return response.json(model)
  },
})
