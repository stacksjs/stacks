import type { DigitalDeliveryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { digital } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DigitalDelivery Show',
  description: 'DigitalDelivery Show ORM Action',
  method: 'GET',
  async handle(request: DigitalDeliveryRequestType) {
    const id = request.getParam<number>('id')

    const model = await digital.fetchById(id)

    return response.json(model)
  },
})
