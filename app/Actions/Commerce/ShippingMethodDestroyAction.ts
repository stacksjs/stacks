import type { ShippingMethodRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'ShippingMethod Destroy',
  description: 'ShippingMethod Destroy ORM Action',
  method: 'DELETE',
  async handle(request: ShippingMethodRequestType) {
    const id = request.getParam<number>('id')

    const model = await ShippingMethod.findOrFail(id)

    model.delete()

    return 'Model deleted!'
  },
})
