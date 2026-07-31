import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'DeliveryRoute Show',
  description: 'DeliveryRoute Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Delivery route')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await shippings.routes.fetchById(id)
    if (!model)
      return commerceNotFound('Delivery route', id)

    return response.json(model)
  },
})
