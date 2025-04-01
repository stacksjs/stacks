import type { DigitalDeliveryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DigitalDelivery Store',
  description: 'DigitalDelivery Store ORM Action',
  method: 'POST',
  async handle(request: DigitalDeliveryRequestType) {
    await request.validate()
    const model = await DigitalDelivery.create(request.all())

    return response.json(model)
  },
})
