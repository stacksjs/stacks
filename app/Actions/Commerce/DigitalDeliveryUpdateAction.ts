import type { DigitalDeliveryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { digital } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DigitalDelivery Update',
  description: 'DigitalDelivery Update ORM Action',
  method: 'PUT',
  async handle(request: DigitalDeliveryRequestType) {
    await request.validate()
    const id = request.getParam<number>('id')

    const model = await digital.update(id, request)

    return response.json(model)
  },
})
