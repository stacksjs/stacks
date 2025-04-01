import type { DigitalDeliveryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { digital } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DigitalDelivery Store',
  description: 'DigitalDelivery Store ORM Action',
  method: 'POST',
  async handle(request: DigitalDeliveryRequestType) {
    await request.validate()

    const model = await digital.store(request)

    return response.json(model)
  },
})
