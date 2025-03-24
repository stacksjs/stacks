import type { DigitalDeliveryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DigitalDelivery Show',
  description: 'DigitalDelivery Show ORM Action',
  method: 'GET',
  async handle(request: DigitalDeliveryRequestType) {
    const id = request.getParam('id')

    const model = await DigitalDelivery.findOrFail(Number(id))

    return response.json(model)
  },
})
