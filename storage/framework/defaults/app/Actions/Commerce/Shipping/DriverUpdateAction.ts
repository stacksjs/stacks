import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Driver Update',
  description: 'Driver Update ORM Action',
  method: 'PUT',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')
    const data = await request.all()

    const model = await shippings.drivers.update(id, data)

    return response.json(model)
  },
})
