import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Driver Store',
  description: 'Driver Store ORM Action',
  method: 'POST',
  model: Driver,
  async handle(request: RequestInstance) {
    await request.validate()
    const data = await request.all()
    const model = await shippings.drivers.store(data)

    return response.json(model)
  },
})
