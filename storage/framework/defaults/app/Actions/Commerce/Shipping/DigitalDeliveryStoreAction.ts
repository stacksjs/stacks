import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DigitalDelivery Store',
  description: 'DigitalDelivery Store ORM Action',
  method: 'POST',
  model: DigitalDelivery,
  async handle(request: RequestInstance) {
    await request.validate()
    const data = await request.all()

    const model = await shippings.digital.store(data)

    return response.json(model)
  },
})
