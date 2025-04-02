import type { ShippingMethodRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { shipping } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingMethod Store',
  description: 'ShippingMethod Store ORM Action',
  method: 'POST',
  async handle(request: ShippingMethodRequestType) {
    const model = await shipping.store(request)

    return response.json(model)
  },
})
