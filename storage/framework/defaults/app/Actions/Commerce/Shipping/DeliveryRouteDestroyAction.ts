import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'DeliveryRoute Destroy',
  description: 'DeliveryRoute Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Delivery route')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await shippings.routes.destroy(id)
    if (!deleted)
      return commerceNotFound('Delivery route', id)

    return response.json({ message: 'DeliveryRoute deleted successfully' })
  },
})
