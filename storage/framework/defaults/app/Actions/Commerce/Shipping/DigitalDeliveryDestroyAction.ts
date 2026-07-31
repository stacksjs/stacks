import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { shippingIdentifier, shippingNotFound } from './shipping-action'

export default new Action({
  name: 'DigitalDelivery Destroy',
  description: 'DigitalDelivery Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = shippingIdentifier(request, 'Digital delivery')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await shippings.digital.destroy(id)
    if (!deleted)
      return shippingNotFound('Digital delivery', id)

    return response.json({ message: 'DigitalDelivery deleted successfully' })
  },
})
