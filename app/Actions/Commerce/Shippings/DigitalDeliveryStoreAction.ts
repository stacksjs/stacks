import type { DigitalDeliveryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DigitalDelivery Store',
  description: 'DigitalDelivery Store ORM Action',
  method: 'POST',
  async handle(request: DigitalDeliveryRequestType) {
    const model = await shippings.digital.store(request)

    return response.json(model)
  },
})
