import type { DigitalDeliveryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { digital } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DigitalDelivery Destroy',
  description: 'DigitalDelivery Destroy ORM Action',
  method: 'DELETE',
  async handle(request: DigitalDeliveryRequestType) {
    const id = request.getParam<number>('id')

    await digital.destroy(id)

    return response.json({ message: 'DigitalDelivery deleted successfully' })
  },
})
