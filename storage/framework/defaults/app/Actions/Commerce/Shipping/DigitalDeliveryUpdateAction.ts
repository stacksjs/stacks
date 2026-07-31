import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'DigitalDelivery Update',
  description: 'DigitalDelivery Update ORM Action',
  method: 'PATCH',
  model: DigitalDelivery,
  async handle(request: RequestInstance) {
    await request.validate()
    const id = request.getParam('id')
    const data = await request.all()

    const model = await shippings.digital.update(id, data)

    return response.json(model)
  },
})
