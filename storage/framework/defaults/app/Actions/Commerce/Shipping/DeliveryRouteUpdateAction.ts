import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'DeliveryRoute Update',
  description: 'DeliveryRoute Update ORM Action',
  method: 'PATCH',
  model: DeliveryRoute,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Delivery route')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = await request.all()

    try {
      const model = await shippings.routes.update(id, data)
      if (!model)
        return commerceNotFound('Delivery route', id)

      return response.json(model)
    }
    catch (error) {
      if (error instanceof shippings.routes.DeliveryRouteInputError)
        return response.json({ message: error.message }, 422)
      throw error
    }
  },
})
