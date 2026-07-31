import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'LicenseKey Show',
  description: 'LicenseKey Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'License key')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await shippings.licenses.fetchById(id)
    if (!model)
      return commerceNotFound('License key', id)

    return response.json(model)
  },
})
