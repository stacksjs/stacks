import type { ShippingMethodRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingMethod Update',
  description: 'ShippingMethod Update ORM Action',
  method: 'PATCH',
  async handle(request: ShippingMethodRequestType) {
    const id = request.getParam('id')
    const model = await shippings.methods.update(id, request)

    return response.json(model)
  },
})
