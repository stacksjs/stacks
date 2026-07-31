import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'ShippingRate Show',
  description: 'ShippingRate Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Shipping rate')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await shippings.rates.fetchById(id)
    if (!model)
      return commerceNotFound('Shipping rate', id)

    return response.json(model)
  },
})
