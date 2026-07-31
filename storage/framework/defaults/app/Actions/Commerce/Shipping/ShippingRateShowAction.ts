import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { shippingIdentifier, shippingNotFound } from './shipping-action'

export default new Action({
  name: 'ShippingRate Show',
  description: 'ShippingRate Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = shippingIdentifier(request, 'Shipping rate')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await shippings.rates.fetchById(id)
    if (!model)
      return shippingNotFound('Shipping rate', id)

    return response.json(model)
  },
})
