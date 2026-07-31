import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { shippingIdentifier, shippingNotFound } from './shipping-action'

export default new Action({
  name: 'LicenseKey Destroy',
  description: 'LicenseKey Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = shippingIdentifier(request, 'License key')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await shippings.licenses.destroy(id)
    if (!deleted)
      return shippingNotFound('License key', id)

    return response.json({
      message: 'License key deleted successfully',
    })
  },
})
