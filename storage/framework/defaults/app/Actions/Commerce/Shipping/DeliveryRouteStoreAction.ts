import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DeliveryRoute Store',
  description: 'DeliveryRoute Store ORM Action',
  method: 'POST',
  async handle(request: RequestInstance) {
    const model = await shippings.routes.store(request)

    return response.json(model)
  },
})
