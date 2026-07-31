import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DeliveryRoute Update',
  description: 'DeliveryRoute Update ORM Action',
  method: 'PATCH',
  model: DeliveryRoute,
  async handle(request: RequestInstance) {
    await request.validate()
    const id = request.getParam('id')
    const data = await request.all()

    try {
      const model = await shippings.routes.update(id, data)

      return response.json(model)
    }
    catch (error) {
      if (error instanceof shippings.routes.DeliveryRouteInputError)
        return response.json({ message: error.message }, 422)
      throw error
    }
  },
})
