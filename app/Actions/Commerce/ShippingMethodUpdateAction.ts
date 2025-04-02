import type { ShippingMethodRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingMethod Update',
  description: 'ShippingMethod Update ORM Action',
  method: 'PATCH',
  async handle(request: ShippingMethodRequestType) {
    await request.validate()

    const id = request.getParam<number>('id')
    const model = await ShippingMethod.findOrFail(id)

    const result = model.update(request.all())

    return response.json(result)
  },
})
