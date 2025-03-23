import type { ShippingMethodRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'ShippingMethod Destroy',
  description: 'ShippingMethod Destroy ORM Action',
  method: 'DELETE',
  async handle(request: ShippingMethodRequestType) {
    const id = request.getParam('id')

    const model = await ShippingMethod.findOrFail(Number(id))

    model.delete()

    return 'Model deleted!'
  },
})
