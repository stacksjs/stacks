import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { shippingIdentifier, shippingNotFound } from './shipping-action'

export default new Action({
  name: 'ShippingZone Show',
  description: 'ShippingZone Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = shippingIdentifier(request, 'Shipping zone')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await shippings.zones.fetchById(id)
    if (!model)
      return shippingNotFound('Shipping zone', id)

    return response.json(model)
  },
})
