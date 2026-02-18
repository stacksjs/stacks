import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DigitalDelivery Update',
  description: 'DigitalDelivery Update ORM Action',
  method: 'PUT',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')

    const model = await shippings.digital.update(id, request)

    return response.json(model)
  },
})
