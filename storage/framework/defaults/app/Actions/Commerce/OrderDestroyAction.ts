import { Action } from '@stacksjs/actions'

import { orders } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Order Destroy',
  description: 'Order Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Order')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await orders.destroy(id)
    if (!deleted)
      return commerceNotFound('Order', id)

    return response.noContent()
  },
})
