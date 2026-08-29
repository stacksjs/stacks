import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Courier Store',
  description: 'Courier Store ORM Action',
  method: 'POST',
  model: Courier,
  async handle(request: RequestInstance) {
    await request.validate()
    const data = await request.all()
    const model = await shippings.couriers.store(data)

    return response.json(model)
  },
})
