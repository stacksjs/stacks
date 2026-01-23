import type { DigitalDeliveryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DigitalDelivery Destroy',
  description: 'DigitalDelivery Destroy ORM Action',
  method: 'DELETE',
  async handle(request: DigitalDeliveryRequestType) {
    const id = request.getParam('id')

    await shippings.digital.destroy(id)

    return response.json({ message: 'DigitalDelivery deleted successfully' })
  },
})
