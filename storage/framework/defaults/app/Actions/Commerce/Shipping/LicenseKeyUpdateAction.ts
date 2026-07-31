import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'LicenseKey Update',
  description: 'LicenseKey Update ORM Action',
  method: 'PATCH',
  model: LicenseKey,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'License key')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = await request.all()

    try {
      const results = await shippings.licenses.update(id, data)
      if (!results)
        return commerceNotFound('License key', id)

      return response.json(results)
    }
    catch (error) {
      if (error instanceof shippings.licenses.LicenseKeyInputError)
        return response.json({ message: error.message }, 422)
      throw error
    }
  },
})
