import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingRate Update',
  description: 'ShippingRate Update ORM Action',
  method: 'PATCH',
  model: ShippingRate,
  async handle(request: RequestInstance) {
    await request.validate()
    const id = request.getParam('id')
    const data = await request.all()

    try {
      const model = await shippings.rates.update(id, data)

      return response.json(model)
    }
    catch (error) {
      if (error instanceof shippings.rates.ShippingRateInputError)
        return response.json({ message: error.message }, 422)
      throw error
    }
  },
})
