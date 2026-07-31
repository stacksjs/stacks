import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'ShippingMethod Show',
  description: 'ShippingMethod Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Shipping method')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await shippings.methods.fetchById(id)
    if (!model)
      return commerceNotFound('Shipping method', id)

    return response.json(model)
  },
})
