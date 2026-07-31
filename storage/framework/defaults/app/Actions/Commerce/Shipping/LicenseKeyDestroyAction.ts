import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'LicenseKey Destroy',
  description: 'LicenseKey Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'License key')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await shippings.licenses.destroy(id)
    if (!deleted)
      return commerceNotFound('License key', id)

    return response.json({
      message: 'License key deleted successfully',
    })
  },
})
