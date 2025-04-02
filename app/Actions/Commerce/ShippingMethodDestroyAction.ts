import type { ShippingMethodRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { shipping } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ShippingMethod Destroy',
  description: 'ShippingMethod Destroy ORM Action',
  method: 'DELETE',
  async handle(request: ShippingMethodRequestType) {
    const id = request.getParam<number>('id')

    await shipping.destroy(id)

    return response.json({ message: 'ShippingMethod deleted successfully' })
  },
})
