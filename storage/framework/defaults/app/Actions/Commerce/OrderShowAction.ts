import { Action } from '@stacksjs/actions'

import { orders } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Order Show',
  description: 'Order Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Order')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await orders.fetchById(id)
    if (!model)
      return commerceNotFound('Order', id)

    return response.json(model)
  },
})
