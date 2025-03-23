import type { ShippingMethodRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingMethod Store',
  description: 'ShippingMethod Store ORM Action',
  method: 'POST',
  async handle(request: ShippingMethodRequestType) {
    await request.validate()
    const model = await ShippingMethod.create(request.all())

    return response.json(model)
  },
})
