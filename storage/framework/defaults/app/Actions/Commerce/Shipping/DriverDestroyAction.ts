import { Action } from '@stacksjs/actions'
import { shippings } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { shippingIdentifier, shippingNotFound } from './shipping-action'

export default new Action({
  name: 'Driver Destroy',
  description: 'Driver Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = shippingIdentifier(request, 'Driver')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await shippings.drivers.destroy(id)
    if (!deleted)
      return shippingNotFound('Driver', id)

    return response.json({ message: 'Driver deleted successfully' })
  },
})
