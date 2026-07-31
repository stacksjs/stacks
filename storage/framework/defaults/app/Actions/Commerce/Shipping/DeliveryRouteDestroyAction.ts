import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { shippingIdentifier, shippingNotFound } from './shipping-action'

export default new Action({
  name: 'DeliveryRoute Destroy',
  description: 'DeliveryRoute Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = shippingIdentifier(request, 'Delivery route')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await shippings.routes.destroy(id)
    if (!deleted)
      return shippingNotFound('Delivery route', id)

    return response.json({ message: 'DeliveryRoute deleted successfully' })
  },
})
