import type { ShippingMethodRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingMethod Store',
  description: 'ShippingMethod Store ORM Action',
  method: 'POST',
  async handle(request: ShippingMethodRequestType) {
    const data = request.all()

    const model = await shippings.methods.store(data)

    return response.json(model)
  },
})
