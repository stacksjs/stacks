import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'ShippingRate Update',
  description: 'ShippingRate Update ORM Action',
  method: 'PATCH',
  model: ShippingRate,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Shipping rate')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = await request.all()

    try {
      const model = await shippings.rates.update(id, data)
      if (!model)
        return commerceNotFound('Shipping rate', id)

      return response.json(model)
    }
    catch (error) {
      if (error instanceof shippings.rates.ShippingRateInputError)
        return response.json({ message: error.message }, 422)
      throw error
    }
  },
})
