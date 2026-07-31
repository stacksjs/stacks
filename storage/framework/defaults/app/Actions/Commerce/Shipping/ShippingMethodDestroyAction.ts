import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { shippingIdentifier, shippingNotFound } from './shipping-action'

export default new Action({
  name: 'ShippingMethod Destroy',
  description: 'ShippingMethod Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = shippingIdentifier(request, 'Shipping method')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await shippings.methods.destroy(id)
    if (!deleted)
      return shippingNotFound('Shipping method', id)

    return response.json({ message: 'ShippingMethod deleted successfully' })
  },
})
