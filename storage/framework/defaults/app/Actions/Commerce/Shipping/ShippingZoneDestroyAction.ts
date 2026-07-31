import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { shippingIdentifier, shippingNotFound } from './shipping-action'

export default new Action({
  name: 'ShippingZone Destroy',
  description: 'ShippingZone Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = shippingIdentifier(request, 'Shipping zone')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await shippings.zones.destroy(id)
    if (!deleted)
      return shippingNotFound('Shipping zone', id)

    return response.json({ message: 'ShippingZone deleted successfully' })
  },
})
